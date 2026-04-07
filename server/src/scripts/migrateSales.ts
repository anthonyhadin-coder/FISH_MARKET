import pool from '../core/db';

async function migrate() {
    try {
        console.log('Running migration: adding amount_paid to sales...');
        
        // Check if amount_paid exists
        const [columns]: any = await pool.query(`SHOW COLUMNS FROM sales LIKE 'amount_paid'`);
        
        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE sales 
                ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0 
                AFTER buyer_name
            `);
            console.log('Column amount_paid added.');
        } else {
            console.log('Column amount_paid already exists.');
        }

        // Convert existing cash_received = TRUE to amount_paid = total
        await pool.query(`
            UPDATE sales SET amount_paid = total WHERE cash_received = 1 AND amount_paid = 0
        `);

        // We can keep cash_received for now to avoid breaking existing code, 
        // but let's move towards using amount_paid.
        
        console.log('Migration successful.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
