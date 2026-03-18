import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import pipelinesRouter from './api/pipelines.js';
import webhooksRouter from './api/webhooks.js';
import jobsRouter from './api/jobs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/pipelines', pipelinesRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api/jobs', jobsRouter);


// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

setTimeout(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}/api`);
    console.log(`📍 Webhooks: http://localhost:${PORT}/webhooks/:pipelineId`);
  });
}, 5000);