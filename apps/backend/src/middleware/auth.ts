import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlocked } from '../config/redis';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        role: string;
        // jti + exp are decoded from the JWT access token and used
        // by the logout handler to denylist the token in Redis (FIX 3).
        jti?: string;
        exp?: number;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Prefer HttpOnly access_token cookie; fall back to Authorization header for tooling/tests
    let token = req.cookies?.access_token;

    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '');
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number; role: string; jti?: string; exp?: number };
        
        // Fix 3: Check stateless Redis denylist for logout invalidation
        if (decoded.jti && await isTokenBlocked(decoded.jti)) {
            return res.status(401).json({ message: 'Session expired (revoked). Please log in again.' });
        }

        req.user = decoded;
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            logger.warn('JWT Access Token Expired');
            return res.status(401).json({ message: 'Session expired', code: 'TOKEN_EXPIRED' });
        }
        logger.error(`JWT Verification Failed: ${err.message}`, { name: err.name });
        res.status(401).json({ message: 'Token is not valid' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.map(r => r.toUpperCase()).includes(req.user.role.toUpperCase())) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};
