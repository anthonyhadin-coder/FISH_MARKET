import pool from '../config/db';

async function run() {
  try {
    await pool.query('ALTER TABLE users MODIFY phone VARCHAR(20) UNIQUE NULL;');
    console.log('Successfully altered users table: phone is now NULLABLE.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit(0);
  }
}
run();
