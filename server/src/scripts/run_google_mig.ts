import pool from '../config/db';

async function addCol(query: string) {
    try {
        await pool.query(query);
    } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME') {
            throw e;
        }
    }
}

async function runSQL() {
    try {
        console.log('Running add_google_auth.sql (safe mode)...');
        
        await addCol('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE NULL;');
        await addCol('ALTER TABLE users ADD COLUMN google_email VARCHAR(255) NULL;');
        await addCol('ALTER TABLE users ADD COLUMN google_picture VARCHAR(500) NULL;');
        await addCol("ALTER TABLE users ADD COLUMN auth_provider ENUM('phone', 'google', 'both') NOT NULL DEFAULT 'phone';");
        
        // Ensure index
        try {
            await pool.query('CREATE INDEX idx_google_id ON users(google_id);');
        } catch (e: any) {
            if (e.code !== 'ER_DUP_KEYNAME') {
                console.warn('Index error (might already exist):', e.message);
            }
        }

        console.log('Successfully ran add_google_auth migration.');
    } catch (e) {
        console.error('SQL execution failed:', e);
    } finally {
        process.exit(0);
    }
}
runSQL();
