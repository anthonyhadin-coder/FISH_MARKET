import pool from '../config/db';

async function migrate() {
    try {
        console.log('Running forgot password migration...');
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS reset_otp_hash VARCHAR(255) NULL,
            ADD COLUMN IF NOT EXISTS reset_otp_expiry DATETIME NULL,
            ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255) NULL,
            ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME NULL;
        `);
        console.log('Migration successful.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
