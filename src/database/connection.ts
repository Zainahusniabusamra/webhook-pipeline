import pg from 'pg';

const pool = new pg.Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'postgres', 
  port: 5432,
  database: 'webhook_pipeline',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

export default pool;