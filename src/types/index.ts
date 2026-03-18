export interface Pipeline {
  id: string;
  name: string;
  action_type: 'extract' | 'transform' | 'aggregate';
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface Subscriber {
  id: string;
  pipeline_id: string;
  url: string;
  created_at: Date;
}

export interface Job {
  id: string;
  pipeline_id: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryAttempt {
  id: string;
  job_id: string;
  subscriber_id: string;
  status: 'pending' | 'success' | 'failed';
  attempt_number: number;
  error_message?: string;
  response_status_code?: number;
  created_at: Date;
  next_retry_at?: Date;
}