import pool from '../core/db';

async function unlock() {
  try {
    console.log('Unlocking demo accounts...');
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL');
    console.log('✅ Accounts unlocked successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to unlock accounts:', err);
    process.exit(1);
  }
}

unlock();
