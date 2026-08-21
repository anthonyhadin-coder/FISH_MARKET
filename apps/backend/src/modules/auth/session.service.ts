/**
 * session.service.ts
 * Handles session lifecycle: issuing, refreshing, and clearing auth cookies.
 * Extracted from auth.ts (Phase 11). All cookie settings preserved exactly.
 */
import { Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '@fishmarket/database';
import { generateTokens, hashToken } from './token.service';

const isProduction = process.env.NODE_ENV === 'production';

/** Set the three auth cookies (access_token, refresh_token, csrf_token). */
export function setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    keepSignedIn: boolean = true
): void {
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        ...(keepSignedIn ? { maxAge: 15 * 60 * 1000 } : {}),
        path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        ...(keepSignedIn ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
        path: '/api/auth/refresh',
    });

    const csrfToken = randomUUID();
    res.cookie('csrf_token', csrfToken, {
        httpOnly: false, // Must be readable by JS for double-submit pattern
        secure: isProduction,
        sameSite: 'lax',
        ...(keepSignedIn ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
        path: '/',
    });
}

/** Clear all three auth cookies on logout. */
export function clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.clearCookie('csrf_token', { path: '/' });
}

export interface SessionUser {
    id: number;
    name: string;
    role: string;
    phone?: string;
    language?: string;
}

/**
 * Issue a new session (access + refresh tokens) for a user.
 * Persists the refresh token hash to the DB and resets the user's lockout state.
 * Returns the safe user object for the API response.
 */
export async function issueSession(
    res: Response,
    user: SessionUser,
    keepSignedIn: boolean = true
): Promise<{ user: SessionUser & { role: string } }> {
    const { accessToken, refreshToken, familyId } = generateTokens(user.id, user.role);
    const tokenHash = hashToken(refreshToken);

    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [user.id, tokenHash, familyId]
    );

    await pool.query(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
        [user.id]
    );

    setAuthCookies(res, accessToken, refreshToken, keepSignedIn);

    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.toLowerCase(),
            phone: user.phone,
            language: user.language,
        }
    };
}
