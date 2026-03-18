import express from 'express';
import type { Request, Response } from 'express';
import pool from '../database/connection.js';

const router = express.Router();

// Get all jobs
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, pipeline_id, status, created_at, updated_at FROM jobs ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get job by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const jobResult = await pool.query(
      'SELECT * FROM jobs WHERE id = $1',
      [id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Get delivery attempts
    const deliveryResult = await pool.query(
      'SELECT * FROM delivery_attempts WHERE job_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      job,
      delivery_attempts: deliveryResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;