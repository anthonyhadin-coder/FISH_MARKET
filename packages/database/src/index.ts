import mysql from 'mysql2/promise';


// Construct DATABASE_URL from individual parameters if not set
if (!process.env.DATABASE_URL) {
  // DATABASE_URL not set — attempt construction from individual DB_* vars
  
  if (!process.env.DB_HOST || !process.env.DB_USER) {
    throw new Error('FATAL: DATABASE_URL environment variable is missing, and no DB_HOST / DB_USER was provided.');
  }

  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'fish_market';

  // URL encode credentials to handle special characters
  const encodedUser = encodeURIComponent(dbUser);
  const encodedPassword = encodeURIComponent(dbPassword);
  
  process.env.DATABASE_URL = `mysql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: process.env.NODE_ENV === 'production' ? 50 : 10,
  queueLimit: 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export const query = async (text: string, params?: any[]) => {
  const [results] = await pool.execute(text, params);
  return results;
};

export default pool;
