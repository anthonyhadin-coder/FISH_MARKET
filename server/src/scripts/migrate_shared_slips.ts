import pool from '../core/db';

async function migrate() {
    try {
        console.log('Starting migration for shared_slips...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS shared_slips (
                id INT AUTO_INCREMENT PRIMARY KEY,
                boat_id INT NOT NULL,
                agent_id INT NOT NULL,
                owner_id INT NOT NULL,
                date DATE NOT NULL,
                slip_data JSON NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL,
                status ENUM('sent', 'read') DEFAULT 'sent',
                FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_daily_slip (boat_id, date)
            );
        `);

        console.log('Migration successful: shared_slips table created/verified.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
