import pool from '../database/connection.js';

interface ProcessResult {
  success: boolean;
  data?: any;
  error?: string;
}

function extractAction(payload: any): ProcessResult {
  try {
    const extracted = {
      user_id: payload.user_id,
      email: payload.email
    };
    return { success: true, data: extracted };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function transformAction(payload: any): ProcessResult {
  try {
    const transformed = {
      ...payload,
      email_domain: payload.email?.split('@')[1] || null,
      processed_at: new Date().toISOString()
    };
    return { success: true, data: transformed };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function aggregateAction(payload: any): ProcessResult {
  try {
    const aggregate = {
      total_fields: Object.keys(payload).length,
      field_names: Object.keys(payload),
      payload_size_bytes: JSON.stringify(payload).length,
      processed_at: new Date().toISOString()
    };
    return { success: true, data: aggregate };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function processJob(payload: any, actionType: string): ProcessResult {
  switch (actionType) {
    case 'extract':
      return extractAction(payload);
    case 'transform':
      return transformAction(payload);
    case 'aggregate':
      return aggregateAction(payload);
    default:
      return { success: false, error: `Unknown action type: ${actionType}` };
  }
}

// Deliver result to subscriber
async function deliverToSubscriber(
  jobId: string,
  subscriberId: string,
  subscriberUrl: string,
  result: any,
  attemptNumber: number = 1
): Promise<boolean> {
  try {
    console.log(`📤 Attempt ${attemptNumber}: Sending to ${subscriberUrl}`);

    const response = await fetch(subscriberUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        result: result,
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      // Success
      await pool.query(
        'INSERT INTO delivery_attempts (job_id, subscriber_id, status, attempt_number, response_status_code) VALUES ($1, $2, $3, $4, $5)',
        [jobId, subscriberId, 'success', attemptNumber, response.status]
      );

      console.log(`✅ Delivered successfully to ${subscriberUrl}`);
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const errorMsg = String(error);
    console.log(`❌ Delivery failed: ${errorMsg}`);

    // Calculate next retry time (exponential backoff)
    const delaySeconds = Math.min(Math.pow(2, attemptNumber - 1) * 5, 300); // 5s, 10s, 20s, ..., max 5m
    const nextRetry = new Date(Date.now() + delaySeconds * 1000);

    // Record the failed attempt
    await pool.query(
      'INSERT INTO delivery_attempts (job_id, subscriber_id, status, attempt_number, error_message, response_status_code, next_retry_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [jobId, subscriberId, 'failed', attemptNumber, errorMsg, null, nextRetry]
    );

    return false;
  }
}

async function startWorker() {
  console.log('🚀 Worker started...');

  // Run forever
  while (true) {
    try {
      const jobsResult = await pool.query(
        'SELECT j.*, p.action_type FROM jobs j JOIN pipelines p ON j.pipeline_id = p.id WHERE j.status = $1 LIMIT 5',
        ['pending']
      );

      const jobs = jobsResult.rows;

      if (jobs.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      console.log(`📦 Found ${jobs.length} pending job(s)`);

      for (const job of jobs) {
        try {
          await pool.query(
            'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', job.id]
          );

          console.log(`⚙️ Processing job: ${job.id}`);

          const payload = typeof job.payload === 'string' 
            ? JSON.parse(job.payload) 
            : job.payload;

          const result = processJob(payload, job.action_type);

          if (result.success) {
            await pool.query(
              'UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3',
              ['completed', JSON.stringify(result.data), job.id]
            );

            console.log(`✅ Job processed: ${job.id}`);

            const subscribersResult = await pool.query(
              'SELECT id, url FROM subscribers WHERE pipeline_id = $1',
              [job.pipeline_id]
            );

            const subscribers = subscribersResult.rows;

            if (subscribers.length === 0) {
              console.log(`ℹ️ No subscribers for job ${job.id}`);
            } else {
              console.log(`📨 Delivering to ${subscribers.length} subscriber(s)`);

              for (const subscriber of subscribers) {
                await deliverToSubscriber(
                  job.id,
                  subscriber.id,
                  subscriber.url,
                  result.data,
                  1
                );
              }
            }
          } else {
            await pool.query(
              'UPDATE jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
              ['failed', result.error, job.id]
            );

            console.log(`❌ Job failed: ${job.id} - ${result.error}`);
          }
        } catch (error) {
          console.error(`Error processing job ${job.id}:`, error);
          
          await pool.query(
            'UPDATE jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', String(error), job.id]
          );
        }
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startWorker().catch(error => {
  console.error('Fatal worker error:', error);
  process.exit(1);
});