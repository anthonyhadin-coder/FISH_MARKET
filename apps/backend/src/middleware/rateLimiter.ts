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
const globalLimiter = new RateLimiterRedis({
    storeClient: redis!,
    keyPrefix: 'rl:global',
    points: 100,
    duration: 15 * 60,
    inMemoryBlockOnConsumed: 100, // Extra protection if Redis is slammed
});

// 2. Auth Brute Force Limiter (5 attempts / 15 min per IP+User)
const authLimiter = new RateLimiterRedis({
    storeClient: redis!,
    keyPrefix: 'rl:auth',
    points: 5,
    duration: 15 * 60,
    blockDuration: 15 * 60, // Lockout for 15 mins
});

// 3. Voice Parsing Limiter (20 req / 1 min)
const voiceLimiter = new RateLimiterRedis({
    storeClient: redis!,
    keyPrefix: 'rl:voice',
    points: 20,
    duration: 60,
});

// Memory fallback for local dev without Redis
const memoryLimiter = new RateLimiterMemory({
    points: 100,
    duration: 15 * 60,
});

const getLimiter = (limiter: RateLimiterRedis) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!redis || redis.status !== 'ready') {
            if (isProduction) {
                logger.error('CRITICAL: Rate limiter failing open - Redis disconnected');
                return next();
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
        const key = authReq.user?.userId ? `u:${authReq.user.userId}` : req.ip;
        
        try {
            await limiter.consume(key!);
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
