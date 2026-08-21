import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import pool from '@fishmarket/database';
import { logger } from '../../utils/logger';
import { catchAsync } from '../../middleware/errors';
import { AuthRequest } from '../../middleware/auth';
import redis, { blockToken } from '../../config/redis';
// Phase 11: auth helpers extracted to focused service files
import { generateTokens, hashToken } from './token.service';
import { setAuthCookies, clearAuthCookies, issueSession } from './session.service';
import { generateOtp, hashOtp, sendSms } from './otp.service';
import { cleanPhoneNumber } from '../../utils/phone';

// ── Env guards ───────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET env var is missing.');

const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
if (!JWT_REFRESH_SECRET) throw new Error('FATAL: REFRESH_TOKEN_SECRET env var is missing.');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;


// Global OAuth component to prevent re-instantiation per request (Cleanup)
let googleClientUrlCached: OAuth2Client | null = null;
const getGoogleClient = () => {
    if (!googleClientUrlCached) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error('GOOGLE_CLIENT_ID env var is missing');
        googleClientUrlCached = new OAuth2Client(clientId);
    }
    return googleClientUrlCached;
};



export const register = catchAsync(async (req: Request, res: Response) => {
    const { name, phone, email, role, password } = req.body;
    if (['ADMIN', 'STAFF'].includes(role?.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid role selection' });
    }
    logger.info('[Register Trace] 1. Received register request');
    const cleanPhone = cleanPhoneNumber(phone);

    logger.info('[Register Trace] 2. Checking for existing user');
    const [existing]: any[] = await pool.query('SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)', [cleanPhone, email || null]);
    if (existing.length > 0) {
        logger.info('[Register Trace] 2. User exists, returning 400');
        return res.status(400).json({ message: 'User already exists with this phone or email' });
    }

    logger.info('[Register Trace] 3. Hashing password...');
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    logger.info('[Register Trace] 4. Inserting user...');
    const [result]: any[] = await pool.query(
        'INSERT INTO users (name, phone, email, role, password_hash) VALUES (?, ?, ?, ?, ?)',
        [name, cleanPhone, email || null, role, hashedPassword]
    );

    const userId = result.insertId;
    logger.info('[Register Trace] 5. User inserted ID: ' + userId);
    
    const data = await issueSession(res, { id: userId, name, role, phone: cleanPhone });

    logger.info('[Register Trace] 6. Registration successful');
    res.status(201).json(data);
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { phone, password, role, keepSignedIn = true } = req.body;
    const cleanPhone = cleanPhoneNumber(phone);

    const [users]: any[] = await pool.query(
        'SELECT id, name, phone, password_hash, role, is_active, failed_attempts, locked_until, language FROM users WHERE phone = ?',
        [cleanPhone]
    );

    if (users.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Account active check
    if (!user.is_active) {
        return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const retryAfter = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000);
        return res.status(429).json({ message: 'Account locked due to too many failed attempts.', retryAfter });
    }

    // Role check
    if (role && user.role.toUpperCase() !== role.toUpperCase()) {
        return res.status(403).json({ message: 'Invalid role for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        // FIX 6: Atomic counter prevents brute-forcing via concurrency race condition
        await pool.query(
            `UPDATE users 
             SET failed_attempts = failed_attempts + 1, 
                 locked_until = IF(failed_attempts >= ?, NOW() + INTERVAL ? MINUTE, NULL) 
             WHERE id = ?`,
            [MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, user.id]
        );
        
        const [updatedUsers]: any[] = await pool.query('SELECT failed_attempts, locked_until FROM users WHERE id = ?', [user.id]);
        const updated = updatedUsers[0];

        if (updated.failed_attempts >= MAX_FAILED_ATTEMPTS) {
            return res.status(429).json({
                message: `Account locked for ${LOCKOUT_MINUTES} minutes.`,
                retryAfter: LOCKOUT_MINUTES * 60,
            });
        }
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Successful login — use issueSession for consistency
    const data = await issueSession(res, user, keepSignedIn);
    res.json(data);
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token;
    if (!token) {
        return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    let decoded: { userId: number; role: string; fid: string };
    try {
        decoded = jwt.verify(token, JWT_REFRESH_SECRET!) as { userId: number; role: string; fid: string };
    } catch {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const tokenHash = hashToken(token);
    const [tokens]: any[] = await pool.query(
        'SELECT id, user_id, family_id, is_revoked FROM refresh_tokens WHERE token_hash = ?',
        [tokenHash]
    );

    // If token not found or already revoked -> Potential Replay Attack
    if (tokens.length === 0 || tokens[0].is_revoked) {
        if (tokens.length > 0) {
            // REPLAY DETECTED: Revoke entire family
            const familyId = tokens[0].family_id;
            logger.error(`SECURITY ALERT: Refresh token reuse detected for user ${decoded.userId}. Revoking family ${familyId}.`);
            await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = ?', [familyId]);
        }
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Security alert: Session compromised. Please log in again.' });
    }

    const savedToken = tokens[0];

    // Check if user is still active
    const [users]: any[] = await pool.query('SELECT is_active FROM users WHERE id = ?', [savedToken.user_id]);
    if (users.length === 0 || !users[0].is_active) {
        clearAuthCookies(res);
        return res.status(401).json({ message: 'Account disabled' });
    }

    // ROTATION: Invalidate current token, issue new one in SAME family
    await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = ?', [savedToken.id]);

    const { accessToken, refreshToken: newRefresh, familyId } = generateTokens(decoded.userId, decoded.role, decoded.fid);
    const newHash = hashToken(newRefresh);

    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [decoded.userId, newHash, familyId]
    );

    setAuthCookies(res, accessToken, newRefresh);
    res.json({ success: true });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const token = req.cookies?.refresh_token;
    
    // Revoke specifically the family of the submitted refresh token if possible
    if (userId && token) {
        try {
            const decoded = jwt.verify(token, JWT_REFRESH_SECRET!) as { fid: string };
            if (decoded.fid) {
                await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = ?', [decoded.fid]);
            }
        } catch {
            // Token expired or invalid, just revoke all for this user to be safe
            await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);
        }
    } else if (userId) {
        // Just revoke all for this user for maximum security on logout if no family identified
        await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);
    }
    
    // FIX 3: Push valid access token to Redis denylist to enforce stateless actual logout functionality
    if (authReq.user?.jti && authReq.user?.exp) {
        await blockToken(authReq.user.jti, authReq.user.exp);
    }
    
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
});

export const me = catchAsync(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [users]: any[] = await pool.query('SELECT id, name, phone, role, language FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(401).json({ message: 'User not found' });
    
    res.json({
        user: {
            id: users[0].id,
            name: users[0].name,
            role: users[0].role.toLowerCase(),
            phone: users[0].phone,
            language: users[0].language,
        }
    });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [users]: any[] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });

    const hashedNew = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // BUG FIX #2: refresh_token_hash column does not exist — tokens live in the refresh_tokens table.
    // Also invalidate all active sessions when password changes (security best practice).
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNew, userId]);
    await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);

    if (authReq.user?.jti && authReq.user?.exp) {
        await blockToken(authReq.user.jti, authReq.user.exp);
    }

    clearAuthCookies(res);
    res.json({ message: 'Password updated. Please log in again.' });
});

/**
 * POST /api/auth/google
 * BUG 2 FIX: Full try/catch with server-side logging + env var guard.
 * On any unhandled OAuth error the handler responds with a structured JSON
 * error instead of crashing the process — the frontend reads this and shows
 * a specific "Google sign-in failed" message instead of a blank screen.
 */
export const googleAuth = async (req: Request, res: Response) => {
    try {
        // BUG 2 FIX: Validate all required OAuth env vars at request time so a
        // missing config surfaces as a clear 500 instead of a cryptic crash.
        // NOTE: We only require GOOGLE_CLIENT_ID because this is a token validation
        // endpoint for frontend-issued JWTs, not an Auth Code grant flow requiring a secret.
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            console.error('[Google OAuth Error] Missing env vars: GOOGLE_CLIENT_ID is not set.');
            return res.status(500).json({ message: 'Google sign-in is not configured on this server.' });
        }

        const { credential, role } = req.body;

        // 1. Verify with Google server-side only
        logger.info('[GoogleAuth Trace] 1. Received credential, starting verification...');
        const client = getGoogleClient();
        let payload: any;
        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: googleClientId,
            });
            payload = ticket.getPayload()!;
            logger.info('[GoogleAuth Trace] 2. Token verified, email: ' + payload.email);
        } catch (verifyErr) {
            logger.error(verifyErr, '[GoogleAuth Trace] 2. ERROR: Token verification failed:');
            return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
        }

    const { sub: googleId, email: googleEmail, name, picture: googlePicture } = payload;
    if (!googleId || !googleEmail) {
        console.error('[GoogleAuth Trace] 2. ERROR: Incomplete payload');
        return res.status(400).json({ message: 'Incomplete Google profile' });
    }

    // 2. Find by google_id
    logger.info('[GoogleAuth Trace] 3. Searching for user by google_id: ' + googleId);
    let [rows]: any[] = await pool.query('SELECT id, name, email, phone, role, language, is_active, google_id, google_picture FROM users WHERE google_id = ?', [googleId]);
    logger.info('[GoogleAuth Trace] 3. Search complete, rows found: ' + rows.length);

    // 3. Fallback: find by email (account merge)
    if (rows.length === 0) {
        logger.info('[GoogleAuth Trace] 4. Fallback search by email');
        [rows] = await pool.query(
            'SELECT id, name, email, phone, role, language, is_active, google_id, google_picture FROM users WHERE (google_email = ? OR email = ?) AND google_id IS NULL',
            [googleEmail, googleEmail]
        );
        if (rows.length > 0) {
            logger.info('[GoogleAuth Trace] 4. Found email match, merging account');
            await pool.query(
                `UPDATE users SET google_id = ?, google_email = ?, google_picture = ?, auth_provider = 'both' WHERE id = ?`,
                [googleId, googleEmail, googlePicture, rows[0].id]
            );
        }
    }

    // 4. New user — needs role selection
    if (rows.length === 0 && !role) {
        logger.info('[GoogleAuth Trace] 5. New user detected, returning needsRoleSelection');
        return res.json({ needsRoleSelection: true, name: name || googleEmail.split('@')[0] });
    }

    // 5. Create new Google user
    if (rows.length === 0 && role) {
        logger.info('[GoogleAuth Trace] 6. Creating new user with role: ' + role);
        const ALLOWED_SELF_REGISTER_ROLES = ['OWNER', 'AGENT', 'BUYER'];
        const requestedRole = (req.body.role || 'BUYER').toString().toUpperCase();
        if (!ALLOWED_SELF_REGISTER_ROLES.includes(requestedRole)) {
            return res.status(400).json({ 
                message: 'Invalid role. Allowed: owner, agent, buyer' 
            });
        }
        const upperRole = requestedRole;
        const [result]: any[] = await pool.query(
            `INSERT INTO users (name, phone, role, google_id, google_email, google_picture, auth_provider, password_hash)
             VALUES (?, NULL, ?, ?, ?, ?, 'google', NULL)`,
            [name || googleEmail, upperRole, googleId, googleEmail, googlePicture]
        );
        rows = [{ id: result.insertId, name, role: upperRole, google_picture: googlePicture }];
        logger.info('[GoogleAuth Trace] 6. User created ID: ' + result.insertId);
    }

    // 6. Log in — use issueSession for rotation support
    const user = rows[0];
    logger.info('[GoogleAuth Trace] 7. Issuing session for user: ' + user.id);
    const data = await issueSession(res, user);
    logger.info('[GoogleAuth Trace] 8. Success, sending user object');

    return res.json(data);
    } catch (err) {
        logger.error(err, '[GoogleAuth Trace] FATAL UNHANDLED ERROR:');
        return res.status(500).json({ message: 'Google sign-in failed. Please try again later.' });
    }
};

// ── Forgot Password Flow ─────────────────────────────────────────

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    const cleanPhone = cleanPhoneNumber(phone);

    // Rate limit: 1 forgot-password OTP per 60s per phone
    if (redis) {
        const cooldown = await redis.get(`forgot_cooldown:${cleanPhone}`);
        if (cooldown) {
            return res.status(429).json({ message: 'Please wait 60s before requesting another OTP' });
        }
    }

    const [rows]: any[] = await pool.query('SELECT id, name FROM users WHERE phone = ?', [cleanPhone]);

    if (rows.length === 0) {
        if (redis) await redis.set(`forgot_cooldown:${cleanPhone}`, '1', 'EX', 60);
        return res.json({ message: 'If registered, OTP will be sent' });
    }

    const user = rows[0];
    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    const otpHash = hashOtp(otp);

    await pool.query(
        'UPDATE users SET reset_otp_hash = ?, reset_otp_expiry = ? WHERE id = ?',
        [otpHash, expiry, user.id]
    );

    if (redis) await redis.set(`forgot_cooldown:${cleanPhone}`, '1', 'EX', 60);

    const sent = await sendSms(cleanPhone, `Your FISH MARKET reset code is: ${otp}. Valid for 10 minutes.`);
    if (!sent) {
        return res.status(500).json({ message: 'Failed to send OTP SMS. Please try again later.' });
    }

    res.json({ message: 'OTP sent successfully' });
});

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    const cleanPhone = cleanPhoneNumber(phone);

    const otpHash = hashOtp(otp);

    const [rows]: any[] = await pool.query(`
        SELECT id FROM users 
        WHERE phone = ? 
          AND reset_otp_hash = ? 
          AND reset_otp_expiry > NOW()
    `, [cleanPhone, otpHash]);

    if (rows.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await pool.query(`
        UPDATE users 
        SET reset_token_hash = ?, 
            reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
            reset_otp_hash = NULL,
            reset_otp_expiry = NULL
        WHERE id = ?
    `, [resetHash, rows[0].id]);

    res.json({ resetToken, message: 'OTP verified' });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { resetToken, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: 'Password min 8 characters' });
    }

    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const [rows]: any[] = await pool.query(`
        SELECT id FROM users 
        WHERE reset_token_hash = ? 
          AND reset_token_expiry > NOW()
    `, [resetHash]);

    if (rows.length === 0) {
        return res.status(400).json({ message: 'Reset link expired' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query(`
        UPDATE users 
        SET password_hash = ?, 
            reset_token_hash = NULL, 
            reset_token_expiry = NULL,
            failed_attempts = 0,
            locked_until = NULL
        WHERE id = ?
    `, [newHash, rows[0].id]);

    res.json({ message: 'Password reset successful' });
});

// Twilio + Redis Login Flow
export const sendLoginOtp = catchAsync(async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    const cleanPhone = cleanPhoneNumber(phone);

    if (!redis) {
        return res.status(500).json({ message: 'Redis is required for OTP login' });
    }

    const cooldown = await redis.get(`login_cooldown:${cleanPhone}`);
    if (cooldown) {
        return res.status(429).json({ message: 'Please wait 60s before requesting another OTP' });
    }

    const [users]: any[] = await pool.query(
        'SELECT id, is_active, locked_until FROM users WHERE phone = ?',
        [cleanPhone]
    );

    if (users.length > 0) {
        const user = users[0];
        if (!user.is_active) return res.status(403).json({ message: 'Account deactivated' });
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(429).json({ message: 'Account locked due to too many failed attempts' });
        }
    }

    const otp = generateOtp();
    
    // BUG-018 FIX: Hash OTP before storing in Redis — prevents exposure if Redis is compromised
    const otpHash = hashOtp(otp);
    await redis.setex(`login_otp:${cleanPhone}`, 300, otpHash);
    await redis.setex(`login_cooldown:${cleanPhone}`, 60, '1');

    const sent = await sendSms(cleanPhone, `Your FISH MARKET login code is: ${otp}. Valid for 5 minutes.`);
    if (!sent) {
        return res.status(500).json({ message: 'Failed to send OTP SMS. Please try again later.' });
    }

    res.json({ message: 'OTP sent successfully' });
});

export const verifyLoginOtp = catchAsync(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    const cleanPhone = cleanPhoneNumber(phone);

    if (!redis) return res.status(500).json({ message: 'Redis is required' });

    // BUG-001 FIX: Track wrong-guess attempts. Lock after 5 wrong tries.
    const attemptsKey = `otp_attempts:${cleanPhone}`;
    const storedOtpHash = await redis.get(`login_otp:${cleanPhone}`);

    if (!storedOtpHash) {
        return res.status(400).json({ message: 'OTP expired or not requested' });
    }

    // BUG-018 FIX: Compare hashed OTP
    const incomingHash = hashOtp(otp);

    if (storedOtpHash !== incomingHash) {
        // Increment wrong-attempt counter (expires with OTP TTL)
        const attempts = await redis.incr(attemptsKey);
        if (attempts === 1) await redis.expire(attemptsKey, 300);

        if (attempts >= 5) {
            // Invalidate OTP after too many wrong guesses
            await redis.del(`login_otp:${cleanPhone}`);
            await redis.del(attemptsKey);
            return res.status(429).json({
                message: 'Too many wrong attempts. OTP invalidated — request a new one.',
            });
        }

        const attemptsLeft = Math.max(0, 5 - attempts);
        return res.status(400).json({
            message: 'Invalid OTP',
            attemptsLeft,
        });
    }

    // OTP is valid — clear it and reset counter
    await redis.del(`login_otp:${cleanPhone}`);
    await redis.del(attemptsKey);

    // Find user
    const [users]: any[] = await pool.query(
        'SELECT id, name, phone, role, is_active, language FROM users WHERE phone = ?',
        [cleanPhone]
    );

    if (users.length === 0) {
        // BUG-002 FIX: Do NOT auto-create AGENT accounts.
        // Mark phone as verified in Redis and ask frontend to pick a role.
        await redis.setex(`verified_phone:${cleanPhone}`, 600, '1');
        return res.json({
            needsRoleSelection: true,
            phone: cleanPhone,
        });
    }

    const user = users[0];
    if (!user.is_active) return res.status(403).json({ message: 'Account deactivated' });

    const data = await issueSession(res, user);
    res.json(data);
});

/**
 * POST /api/auth/phone/complete-registration
 * Called after verifyLoginOtp returns needsRoleSelection = true.
 * Creates the account with the user-selected role.
 */
export const completePhoneRegistration = catchAsync(async (req: Request, res: Response) => {
    const { phone, name, role } = req.body;
    const cleanPhone = cleanPhoneNumber(phone);

    if (!redis) return res.status(500).json({ message: 'Redis is required' });

    // Ensure the phone was actually OTP-verified recently
    const verified = await redis.get(`verified_phone:${cleanPhone}`);
    if (!verified) {
        return res.status(400).json({ message: 'Phone not verified or session expired. Please request a new OTP.' });
    }

    // Validate role
    const ALLOWED_ROLES = ['OWNER', 'AGENT', 'BUYER'];
    if (!ALLOWED_ROLES.includes((role || '').toUpperCase())) {
        return res.status(400).json({ message: 'Invalid role. Choose: OWNER, AGENT, or BUYER' });
    }

    // Check phone not already registered (race-condition guard)
    const [existing]: any[] = await pool.query('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existing.length > 0) {
        // Phone already registered — just log them in
        await redis.del(`verified_phone:${cleanPhone}`);
        const [users]: any[] = await pool.query(
            'SELECT id, name, phone, role, is_active, language FROM users WHERE phone = ?',
            [cleanPhone]
        );
        const user = users[0];
        if (!user.is_active) return res.status(403).json({ message: 'Account deactivated' });
        const data = await issueSession(res, user);
        return res.json(data);
    }

    const [result]: any[] = await pool.query(
        'INSERT INTO users (name, phone, role, password_hash, auth_provider) VALUES (?, ?, ?, NULL, ?)',
        [name || 'User', cleanPhone, role.toUpperCase(), 'phone']
    );

    await redis.del(`verified_phone:${cleanPhone}`);

    const newUser = { id: result.insertId, name: name || 'User', phone: cleanPhone, role: role.toUpperCase(), language: 'en' };
    const data = await issueSession(res, newUser);
    res.status(201).json(data);
});

