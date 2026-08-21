import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { AuthRequest } from './auth';
import redis from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Distributed Rate Limiting Middleware
 * Uses Redis in production, falls back to memory in development.
 */

const isProduction = process.env.NODE_ENV === 'production';

// 1. Standard Global Limiter (100 req / 15 min)
const globalLimiter = redis ? new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:global',
    points: 100,
    duration: 15 * 60,
    inMemoryBlockOnConsumed: 100, // Extra protection if Redis is slammed
}) : null;

// 2. Auth Brute Force Limiter (5 attempts / 15 min per IP+User)
const authLimiter = redis ? new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth',
    points: 5,
    duration: 15 * 60,
    blockDuration: 15 * 60, // Lockout for 15 mins
}) : null;

// 3. Voice Parsing Limiter (20 req / 1 min)
const voiceLimiter = redis ? new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:voice',
    points: 20,
    duration: 60,
}) : null;

// Memory fallback for local dev without Redis
const memoryLimiter = new RateLimiterMemory({
    points: 100,
    duration: 15 * 60,
});

const getLimiter = (limiter: RateLimiterRedis | null) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!redis || redis.status !== 'ready' || !limiter) {
            if (isProduction) {
                logger.error('CRITICAL: Rate limiter failing open - Redis disconnected. Falling back to in-process memory limiter.');
                // BUG FIX #4: Do NOT open-pass in production. Use the in-process memory limiter
                // as a degraded-but-safe fallback instead of bypassing rate limiting entirely.
                try {
                    await memoryLimiter.consume(req.ip ?? 'unknown');
                    return next();
                } catch {
                    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
                }
            }
            // In dev, use memory
            try {
                await memoryLimiter.consume(req.ip!);
                return next();
            } catch {
                return res.status(429).json({ message: 'Too many requests' });
            }
        }

        const authReq = req as AuthRequest;
        // BUG FIX #15: req.ip can be undefined behind a misconfigured proxy.
        // Fall back to 'unknown' to avoid crashing the rate limiter with a non-null assertion.
        const key = authReq.user?.userId ? `u:${authReq.user.userId}` : (req.ip ?? 'unknown');
        
        try {
            await limiter.consume(key);
            next();
        } catch (rlRes: any) {
            const retryAfter = Math.round(rlRes.msBeforeNext / 1000) || 1;
            res.set('Retry-After', String(retryAfter));
            res.status(429).json({ 
                message: 'Too many requests. Please try again later.',
                retryAfter 
            });
        }
    };
};

export const globalRateLimit = getLimiter(globalLimiter);
export const authRateLimit = getLimiter(authLimiter);
export const voiceRateLimit = getLimiter(voiceLimiter);
