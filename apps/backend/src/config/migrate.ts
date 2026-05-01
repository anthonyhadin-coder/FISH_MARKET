import pool from './db';

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // 1. Update status to include pending/rejected
        try {
            await pool.query("ALTER TABLE boats MODIFY COLUMN status ENUM('pending', 'active', 'rejected', 'inactive') DEFAULT 'active'");
            console.log('Updated status column in boats table');
        } catch (e: any) {
            console.log('Status column modification skipped or failed:', e.message);
        }

        // 2. Add requested_by to boats
        try {
            await pool.query('ALTER TABLE boats ADD COLUMN requested_by INT AFTER status');
            console.log('Added requested_by column');
        } catch (e: any) {
             console.log('requested_by column exists or failed:', e.message);
        }

        // 3. Add FK for requested_by
        try {
             await pool.query('ALTER TABLE boats ADD CONSTRAINT fk_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL');
             console.log('Added FK constraint');
        } catch (e: any) {
             console.log('FK constraint exists or failed:', e.message);
        }

        console.log('Migration step completed');
    } catch (err) {
        console.error('Migration crashed:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();
