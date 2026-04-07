import pool from '../core/db';

async function runTest() {
    console.log('--- STARTING GOOGLE AUTH DB TEST ---');
    try {
        const dummyGoogleId = 'test_google_12345';
        const dummyEmail = 'testuser123@gmail.com';
        const dummyName = 'Test User';
        const role = 'AGENT';
        const dummyPicture = 'http://example.com/pic.jpg';

        // 1. Clean up first if exists
        await pool.query('DELETE FROM users WHERE google_id = ?', [dummyGoogleId]);

        // 2. Simulate User Merge Lookup
        let [rows]: any[] = await pool.query(
            'SELECT * FROM users WHERE google_email = ? AND google_id IS NULL',
            [dummyEmail]
        );
        console.log('Merge Lookup Result:', rows.length === 0 ? 'Not found (expected)' : 'Found');

        // 3. Simulate User Insert
        if (rows.length === 0) {
            console.log('Attempting to insert new Google User with NULL phone...');
            const upperRole = role.toUpperCase();
            const [insertResult]: any[] = await pool.query(
                `INSERT INTO users (name, phone, role, google_id, google_email, google_picture, auth_provider, password_hash)
                 VALUES (?, NULL, ?, ?, ?, ?, 'google', '')`,
                [dummyName || dummyEmail, upperRole, dummyGoogleId, dummyEmail, dummyPicture]
            );
            
            console.log('✅ INSERT SUCCESS. Insert ID:', insertResult.insertId);

            // Verify Inserted Data
            const [verifyRows]: any[] = await pool.query('SELECT name, phone, google_id, auth_provider FROM users WHERE id = ?', [insertResult.insertId]);
            console.log('✅ VERIFIED RECORD IN DB:', verifyRows[0]);
        }

    } catch (e) {
        console.error('❌ TEST FAILED with error:', e);
    } finally {
        // Clean up
        console.log('Cleaning up test data...');
        await pool.query('DELETE FROM users WHERE google_id = ?', ['test_google_12345']);
        await pool.end();
        console.log('--- TEST FINISHED ---');
        process.exit(0);
    }
}

runTest();
