import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * CSRF Protection Middleware
 * Implements the Double-Submit Cookie Pattern (stateless).
 * 1. Client receives a 'csrf_token' cookie (not HttpOnly, so JS can read it).
 * 2. Client sends this value in 'x-csrf-token' header for all mutations.
 * 3. Middleware compares the cookie and header values.
 */

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // 1. Skip for safe methods
    if (SAFE_METHODS.includes(req.method)) {
        return next();
    }

    const csrfCookie = req.cookies?.csrf_token;
    const csrfHeader = req.header('x-csrf-token');

    // 2. Validate existence and matching
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        logger.warn(`CSRF validation failed: method=${req.method} url=${req.url} ip=${req.ip}`);
        return res.status(403).json({ 
            message: 'Invalid CSRF token. Please refresh the page.',
            code: 'CSRF_ERROR'
        });
    }

    next();
};
