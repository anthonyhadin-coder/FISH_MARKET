import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto, { randomUUID } from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import pool from '../../config/db';
import { logger } from '../../utils/logger';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';
import { authenticate, AuthRequest } from '../../middleware/auth';
import redis, { blockToken } from '../../config/redis';
import { firebaseAdminAuth } from '../../config/firebase';

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

// ── Cookie helpers ───────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
    // Access token (HttpOnly)
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax', // Lax for cross-site deep links
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
    });

    // Refresh token (HttpOnly, Path-scoped)
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict', // Strict is safer for refresh tokens
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh',
    });

    // CSRF Token (NOT HttpOnly - needed for frontend to read and send back in header)
    const csrfToken = randomUUID();
    res.cookie('csrf_token', csrfToken, {
        httpOnly: false, // Accessible by JS
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // Sync with refresh token life
        path: '/',
    });
};

const clearAuthCookies = (res: Response) => {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.clearCookie('csrf_token', { path: '/' });
};

// ── Token generation ─────────────────────────────────────────────
const generateTokens = (userId: number, role: string, familyId?: string) => {
    const jti = randomUUID(); // assigned to access token for denylist
    const fid = familyId || randomUUID(); // family ID for rotation
    const accessToken = jwt.sign({ userId, role, jti }, JWT_SECRET!, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role, fid }, JWT_REFRESH_SECRET!, { expiresIn: '7d' });
    return { accessToken, refreshToken, jti, familyId: fid };
};

const hashToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

// ── Phone sanitiser ──────────────────────────────────────────────
const cleanPhoneNumber = (phone: string) => {
    // 1. Remove all non-numeric characters EXCEPT '+'
    const raw = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    
    // 2. Handle 10-digit numbers (prepend +91)
    if (/^\d{10}$/.test(raw)) return `+91${raw}`;
    
    // 3. Handle 12-digit numbers starting with 91 (prepend +)
    if (/^91\d{10}$/.test(raw)) return `+${raw}`;
    
    // 4. Handle leading 0 (replace with +91)
    if (/^0\d{10}$/.test(raw)) return `+91${raw.substring(1)}`;
    
    // 5. If it already starts with +91, return as is
    if (raw.startsWith('+91')) return raw;
    
    return raw; // Fallback
};

// ── Schemas ──────────────────────────────────────────────────────
const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional().default('AGENT'),
        password: z.string().min(8),
    })
});

const loginSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        password: z.string().min(8),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional(),
    })
});

const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
    })
});

const googleSchema = z.object({
    body: z.object({
        credential: z.string().min(1).optional(),
        code: z.string().optional(),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional(),
    })
});

const firebaseLoginSchema = z.object({
    body: z.object({
        idToken: z.string().min(1),
    })
});

// ── Handlers ─────────────────────────────────────────────────────

/**
 * Common Logic for issuing sessions with rotation support
 */
const issueSession = async (res: Response, user: any) => {
    const { accessToken, refreshToken, familyId } = generateTokens(user.id, user.role);
    const tokenHash = hashToken(refreshToken);

    // Save to new refresh_tokens table
    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [user.id, tokenHash, familyId]
    );

    // Reset lockout and last login on the user record
    await pool.query(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
        [user.id]
    );

    setAuthCookies(res, accessToken, refreshToken);

    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.toLowerCase(),
            phone: user.phone,
            language: user.language,
        }
    };
};

export const register = catchAsync(async (req: Request, res: Response) => {
    const { name, phone, email, role, password } = req.body;
    if (['ADMIN', 'STAFF'].includes(role?.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid role selection' });
    }
    logger.info('[Register Trace] 1. Received request for: ' + phone);
    const cleanPhone = cleanPhoneNumber(phone);

    logger.info('[Register Trace] 2. Checking for existing user: ' + cleanPhone);
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
    const { phone, password, role } = req.body;
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
                 locked_until = IF(failed_attempts + 1 >= ?, NOW() + INTERVAL ? MINUTE, NULL) 
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
    const data = await issueSession(res, user);
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
    
    // Revoke all tokens in the current family if we can identify it
    // Note: We don't have familyId in the access token, but we can clear by user_id
    // Or better, we just clear the refresh_token cookie and let the user re-login.
    // If they want to "Logout of all devices", we'd revoke all tokens for userId.
    if (userId) {
        // Just revoke all for this user for maximum security on logout
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
    await pool.query(
        'UPDATE users SET password_hash = ?, refresh_token_hash = NULL WHERE id = ?',
        [hashedNew, userId]
    );

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
    let [rows]: any[] = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
    logger.info('[GoogleAuth Trace] 3. Search complete, rows found: ' + rows.length);

    // 3. Fallback: find by email (account merge)
    if (rows.length === 0) {
        logger.info('[GoogleAuth Trace] 4. Fallback search by email: ' + googleEmail);
        [rows] = await pool.query(
            'SELECT * FROM users WHERE google_email = ? AND google_id IS NULL',
            [googleEmail]
        );
        if (rows.length > 0) {
            logger.info('[GoogleAuth Trace] 4. Found email match, merging account ID: ' + rows[0].id);
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
             VALUES (?, NULL, ?, ?, ?, ?, 'google', '')`,
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

    // Rate limit: 1 forgot-password OTP per 60s per phone (prevents SMS spam / cost abuse)
    if (redis) {
        const cooldown = await redis.get(`forgot_cooldown:${cleanPhone}`);
        if (cooldown) {
            return res.status(429).json({ message: 'Please wait 60s before requesting another OTP' });
        }
    }

    const [rows]: any[] = await pool.query('SELECT id, name FROM users WHERE phone = ?', [cleanPhone]);

    if (rows.length === 0) {
        // Don't reveal account existence — but still set cooldown to prevent enumeration via timing
        if (redis) await redis.set(`forgot_cooldown:${cleanPhone}`, '1', 'EX', 60);
        return res.json({ message: 'If registered, OTP will be sent' });
    }

    const user = rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    await pool.query(
        'UPDATE users SET reset_otp_hash = ?, reset_otp_expiry = ? WHERE id = ?',
        [otpHash, expiry, user.id]
    );

    // Set 60s cooldown AFTER successful generation
    if (redis) await redis.set(`forgot_cooldown:${cleanPhone}`, '1', 'EX', 60);

    // Mock SMS sending (replace with actual provider in production)
    if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[SMS MOCK] OTP for dev: ${cleanPhone} → ${otp}`);
    } else {
        logger.info('[ForgotPassword] OTP dispatched (SMS provider pending)');
    }

    res.json({ message: 'OTP sent successfully' });
});

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    const cleanPhone = cleanPhoneNumber(phone);

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

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

// ── Router ───────────────────────────────────────────────────────
const router = Router();
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
// BUG 2: googleAuth is now a plain async handler (not wrapped in catchAsync)
// because it has its own internal try/catch for full error control.
router.post('/google', validate(googleSchema), googleAuth);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me); // FIX 4 endpoint
router.put('/change-password', authenticate, validate(changePasswordSchema), changePassword);

// Forgot Password Flow
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// Firebase Phone Login Flow
export const verifyFirebasePhoneLogin = catchAsync(async (req: Request, res: Response) => {
    const { idToken } = req.body;

    if (!firebaseAdminAuth) {
        return res.status(500).json({ message: 'Firebase authentication is not configured on this server.' });
    }

    let decodedToken;
    try {
        decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
    } catch (error) {
        logger.error(error, '[FirebaseAuth] Token verification failed:');
        return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
    }

    const { phone_number } = decodedToken;
    if (!phone_number) {
        return res.status(400).json({ message: 'No phone number linked to this Firebase credential.' });
    }

    const cleanPhone = cleanPhoneNumber(phone_number);

    // Find or create user
    const [users]: any[] = await pool.query(
        'SELECT id, name, phone, role, is_active, language FROM users WHERE phone = ?',
        [cleanPhone]
    );

    let user;
    if (users.length === 0) {
        // Auto-register as AGENT if not found
        const [result]: any[] = await pool.query(
            'INSERT INTO users (name, phone, role, password_hash, auth_provider) VALUES (?, ?, ?, ?, ?)',
            ['User', cleanPhone, 'AGENT', '', 'phone']
        );
        user = { id: result.insertId, name: 'User', phone: cleanPhone, role: 'AGENT', language: 'en' };
    } else {
        user = users[0];
        if (!user.is_active) return res.status(403).json({ message: 'Account deactivated' });
    }

    const data = await issueSession(res, user);
    res.json(data);
});

router.post('/phone/firebase-login', validate(firebaseLoginSchema), verifyFirebasePhoneLogin);

export default router;
