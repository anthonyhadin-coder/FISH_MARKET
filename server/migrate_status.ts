import pool from './src/core/db';

async function migrate() {
  try {
    console.log('Running migration: ADD COLUMN status TO boats...');
    await pool.query("ALTER TABLE boats ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER agent_id;");
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
