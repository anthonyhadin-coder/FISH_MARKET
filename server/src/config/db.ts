import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to this file or from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Fallback
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

// Diagnostic logging for CI troubleshooting
console.log('[DB-Config] Checking DATABASE_URL presence:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/:(\/\/.*?:).*?@/, ':$1********@');
  console.log('[DB-Config] DATABASE_URL is already set:', maskedUrl);
}

// Construct DATABASE_URL from individual parameters if not set
if (!process.env.DATABASE_URL) {
  console.log('[DB-Config] DATABASE_URL missing, attempting construction from individual parameters...');
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'fish_market';

  // URL encode credentials to handle special characters
  const encodedUser = encodeURIComponent(dbUser);
  const encodedPassword = encodeURIComponent(dbPassword);
  
  process.env.DATABASE_URL = `mysql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;
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
