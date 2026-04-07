import pool from './src/core/db';

async function cleanup() {
    try {
        console.log("--- DB Cleanup & Audit ---");
        
        // Check users table
        const [usersColumns]: any = await pool.query("DESCRIBE users");
        console.log("Users Columns:", usersColumns.map((c: any) => c.Field).join(', '));
        
        // Ensure is_active exists
        if (!usersColumns.find((c: any) => c.Field === 'is_active')) {
            console.log("Adding is_active to users...");
            await pool.query("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE");
        }

        // Check boats table
        const [boatsColumns]: any = await pool.query("DESCRIBE boats");
        console.log("Boats Columns:", boatsColumns.map((c: any) => c.Field).join(', '));

        // Clean up test users
        console.log("Deleting test users...");
        await pool.query("DELETE FROM users WHERE phone IN ('9988776655', '9876543210', '9888777666', '9888777668', '9888777669')");
        
        console.log("Audit complete.");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
}

cleanup();
