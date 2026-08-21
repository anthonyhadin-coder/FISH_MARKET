/**
 * token.service.ts
 * Handles JWT generation and hashing — extracted from auth.ts (Phase 11).
 * All token behavior preserved exactly; no expiry times changed.
 */
import jwt from 'jsonwebtoken';
import crypto, { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET env var is missing.');

const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
if (!JWT_REFRESH_SECRET) throw new Error('FATAL: REFRESH_TOKEN_SECRET env var is missing.');

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    jti: string;
    familyId: string;
}

/** Generate a new access + refresh token pair, optionally re-using an existing family ID. */
export function generateTokens(userId: number, role: string, familyId?: string): TokenPair {
    const jti = randomUUID();              // unique ID for the access token — used in Redis denylist
    const fid = familyId || randomUUID(); // family ID for rotation chain
    const accessToken  = jwt.sign({ userId, role, jti }, JWT_SECRET!, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role, fid }, JWT_REFRESH_SECRET!, { expiresIn: '7d' });
    return { accessToken, refreshToken, jti, familyId: fid };
}

/** SHA-256 hash a token string — used to store refresh tokens safely in the DB. */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
