import pool from '../config/db';

const resetDb = async () => {
  try {
    console.log('Cleaning all tables for a fresh start...');
    
    // Disable foreign key checks to allow dropping/truncating in any order
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'shared_slips',
      'staff_salaries',
      'staff',
      'voice_logs',
      'buyer_transactions',
      'boat_payments',
      'expenses',
      'sales',
      'buyers',
      'boats',
      'users'
    ];

    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`Dropped table: ${table}`);
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database wiped clean.');
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    await pool.end();
  }
};

resetDb();
