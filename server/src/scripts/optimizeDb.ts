import pool from '../core/db';

async function optimize() {
    try {
        console.log('Starting Database Optimization Migration...');

        // 1. Sales Table Enhancements
        console.log('Optimizing sales table...');
        
        // Add buyer_id column if not exists
        const [salesCols]: any = await pool.query("SHOW COLUMNS FROM sales LIKE 'buyer_id'");
        if (salesCols.length === 0) {
            await pool.query('ALTER TABLE sales ADD COLUMN buyer_id INT AFTER boat_id');
            await pool.query('ALTER TABLE sales ADD CONSTRAINT fk_sales_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE SET NULL');
            console.log('Column buyer_id added to sales.');
        }

        // Data Migration: Link sales to buyers via ID where possible
        console.log('Migrating buyer string names to IDs in sales table...');
        await pool.query(`
            UPDATE sales s
            JOIN buyers b ON s.buyer_name = b.name
            SET s.buyer_id = b.id
            WHERE s.buyer_id IS NULL
        `);

        // Add Indices for common filtering patterns
        const [salesIndices]: any = await pool.query('SHOW INDEX FROM sales');
        const indexNames = salesIndices.map((i: any) => i.Key_name);

        if (!indexNames.includes('idx_sales_date')) {
            await pool.query('CREATE INDEX idx_sales_date ON sales(date)');
        }
        if (!indexNames.includes('idx_sales_agent_date')) {
            await pool.query('CREATE INDEX idx_sales_agent_date ON sales(agent_id, date)');
        }
        if (!indexNames.includes('idx_sales_boat_date')) {
            await pool.query('CREATE INDEX idx_sales_boat_date ON sales(boat_id, date)');
        }
        if (!indexNames.includes('idx_sales_buyer')) {
            await pool.query('CREATE INDEX idx_sales_buyer ON sales(buyer_id)');
        }

        // 2. Expenses Table Indices
        console.log('Optimizing expenses table...');
        const [expenseIndices]: any = await pool.query('SHOW INDEX FROM expenses');
        const exIndexNames = expenseIndices.map((i: any) => i.Key_name);

        if (!exIndexNames.includes('idx_expenses_date')) {
            await pool.query('CREATE INDEX idx_expenses_date ON expenses(date)');
        }
        if (!exIndexNames.includes('idx_expenses_boat_date')) {
            await pool.query('CREATE INDEX idx_expenses_boat_date ON expenses(boat_id, date)');
        }

        // 3. Boat Payments Table Indices
        console.log('Optimizing boat_payments table...');
        const [payIndices]: any = await pool.query('SHOW INDEX FROM boat_payments');
        const pIndexNames = payIndices.map((i: any) => i.Key_name);

        if (!pIndexNames.includes('idx_boat_payments_date')) {
            await pool.query('CREATE INDEX idx_boat_payments_date ON boat_payments(date)');
        }
        if (!pIndexNames.includes('idx_boat_payments_boat')) {
            await pool.query('CREATE INDEX idx_boat_payments_boat ON boat_payments(boat_id, date)');
        }

        // 4. Buyer Transactions Table Indices
        console.log('Optimizing buyer_transactions table...');
        const [btIndices]: any = await pool.query('SHOW INDEX FROM buyer_transactions');
        const btIndexNames = btIndices.map((i: any) => i.Key_name);

        if (!btIndexNames.includes('idx_bt_buyer_date')) {
            await pool.query('CREATE INDEX idx_bt_buyer_date ON buyer_transactions(buyer_id, date)');
        }

        console.log('Database Optimization Migration Successful!');
        process.exit(0);
    } catch (err) {
        console.error('Optimization failed:', err);
        process.exit(1);
    }
}

optimize();
