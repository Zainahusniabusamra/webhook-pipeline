import express from 'express';
import type { Request, Response } from 'express';
import pool from '../database/connection.js';

const router = express.Router();

// Create Pipeline
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, action_type, subscribers } = req.body;

    if (!name || !action_type) {
      return res.status(400).json({ error: 'name and action_type are required' });
    }

    const source_url = `/webhooks/${crypto.randomUUID()}`;

    const result = await pool.query(
      'INSERT INTO pipelines (name, action_type, source_url) VALUES ($1, $2, $3) RETURNING *',
      [name, action_type, source_url]
    );

    const pipeline = result.rows[0];

    // Add subscribers
    if (subscribers && Array.isArray(subscribers)) {
      for (const subscriber_url of subscribers) {
        await pool.query(
          'INSERT INTO subscribers (pipeline_id, url) VALUES ($1, $2)',
          [pipeline.id, subscriber_url]
        );
      }
    }

    res.status(201).json(pipeline);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all Pipelines
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM pipelines');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Pipeline by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM pipelines WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Pipeline
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, action_type } = req.body;

    const result = await pool.query(
      'UPDATE pipelines SET name = $1, action_type = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, action_type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Pipeline
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM pipelines WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json({ message: 'Pipeline deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;