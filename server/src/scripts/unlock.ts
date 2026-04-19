import pool from '../config/db';

if (process.env.NODE_ENV === 'production') {
  const readline = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  readline.question(
    '⚠️  WARNING: Running maintenance script in PRODUCTION. Type "yes" to continue: ',
    (answer: string) => {
      readline.close();
      if (answer.toLowerCase() !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
      }
      unlock();
    }
  );
} else {
  unlock();
}

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
