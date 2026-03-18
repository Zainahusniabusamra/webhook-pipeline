import express from 'express';
import type { Request, Response } from 'express';
import pool from '../database/connection.js';

const router = express.Router();

// Receive webhook and create job
router.post('/:pipelineId', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const payload = req.body;

    // Check if pipeline exists
    const pipelineResult = await pool.query(
      'SELECT * FROM pipelines WHERE id = $1',
      [pipelineId]
    );

    if (pipelineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const pipeline = pipelineResult.rows[0];

    // Create job (add to queue)
    const jobResult = await pool.query(
      'INSERT INTO jobs (pipeline_id, payload, status) VALUES ($1, $2, $3) RETURNING *',
      [pipelineId, JSON.stringify(payload), 'pending']
    );

    const job = jobResult.rows[0];

    console.log(`✅ Job created: ${job.id} (Pipeline: ${pipeline.name})`);

    // Return immediately (don't wait for processing)
    res.status(202).json({
      message: 'Webhook received and queued for processing',
      job_id: job.id,
      status: 'pending',
      pipeline: pipeline.name,
      action_type: pipeline.action_type
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;