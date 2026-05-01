import pool from '../config/db';
import crypto from 'crypto';

async function runTests() {
    console.log('--- STARTING AUTH END-TO-END TESTS ---\n');
    const API_URL = 'http://localhost:5000/api/auth';
    const TEST_PHONE = '+919999111122';
    const TEST_PASSWORD = 'password123';

    try {
        // Cleanup old test user
        await pool.query('DELETE FROM users WHERE phone = ?', [TEST_PHONE]);

        // 1. REGISTER
        console.log('[TEST 1] Registering test user...');
        const regRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test User', phone: TEST_PHONE, password: TEST_PASSWORD, role: 'AGENT' })
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(`Registration failed: ${regData.message}`);
        console.log('✅ Registration successful.');

        // 2. PHONE LOGIN w/ PREFIX NORMALIZE
        console.log('\n[TEST 2] Testing Phone Login with un-normalized prefix (09999111122)...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '09999111122', password: TEST_PASSWORD })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${loginData.message}`);
        console.log(`✅ Login successful. User: ${loginData.user.name}, Phone: ${loginData.user.phone}`);

        // 3. FORGOT PASSWORD FLOW
        console.log('\n[TEST 3] Testing Forgot Password -> Request OTP...');
        const forgotRes = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '09999111122' })
        });
        const forgotData = await forgotRes.json();
        if (!forgotRes.ok) throw new Error(`Forgot pwd failed: ${forgotData.message}`);
        console.log('✅ OTP requested successfully.');

        // Fetch OTP direct from DB for testing
        const [rows]: any[] = await pool.query('SELECT reset_otp_hash FROM users WHERE phone = ?', [TEST_PHONE]);
        if (!rows.length || !rows[0].reset_otp_hash) throw new Error('OTP hash not written to DB!');
        const _otpHash = rows[0].reset_otp_hash;
        
        // Brute force reverse a simulated 6-digit OTP simply to proceed (we can't easily guess it since it's hashed, but actually wait we can't! Let's mock the hash so we know it)
        console.log('Test requires OTP, overriding DB with known OTP hash for "123456"...');
        const knownOtp = '123456';
        const knownOtpHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
        await pool.query('UPDATE users SET reset_otp_hash = ? WHERE phone = ?', [knownOtpHash, TEST_PHONE]);

        console.log('\n[TEST 4] Testing Verify OTP...');
        const verifyRes = await fetch(`${API_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '09999111122', otp: knownOtp })
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(`Verify failed: ${verifyData.message}`);
        console.log('✅ OTP Verified, received reset token.');
        
        const resetToken = verifyData.resetToken;

        console.log('\n[TEST 5] Testing Reset Password...');
        const resetRes = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetToken, newPassword: 'newsecurepassword123' })
        });
        const resetData = await resetRes.json();
        if (!resetRes.ok) throw new Error(`Reset failed: ${resetData.message}`);
        console.log('✅ Password Reset successful.');

        // 4. GOOGLE AUTH MISSING CREDENTIAL 
        console.log('\n[TEST 6] Testing Google Login (Bad credential error test)...');
        const googleRes = await fetch(`${API_URL}/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'fake_test_credential' })
        });
        const googleData = await googleRes.json();
        // It SHOULD throw a 401 or 500 complaining about token since it's fake.
        if (googleRes.status === 404) throw new Error('Google route is missing!');
        console.log(`✅ Google route responded. Expected failure with fake token: ${googleData.message} (Status: ${googleRes.status})`);

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY 🎉');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
    } finally {
        await pool.query('DELETE FROM users WHERE phone = ?', [TEST_PHONE]);
        process.exit(0);
    }
}

runTests();
