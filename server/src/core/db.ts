import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to this file or from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Fallback
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  throw new Error('FATAL: DATABASE_URL environment variable is missing.');
}

const pool = mysql.createPool(process.env.DATABASE_URL);

export const query = async (text: string, params?: any[]) => {
  const [results] = await pool.execute(text, params);
  return results;
};

export default pool;
