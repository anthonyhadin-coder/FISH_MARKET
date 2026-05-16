import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;
const isProduction = process.env.NODE_ENV === 'production';

if (redisUrl) {
    redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            if (times > 3) {
                if (isProduction) {
                    logger.error('FATAL: Redis connection failed in production. Denylist and Rate Limiting will fail.');
                } else {
                    logger.warn('Redis connection failed. Falling back to in-memory store.');
                }
                return null; // Stop retrying
            }
            return delay;
        },
    });

    redis.on('connect', () => {
        logger.info('Connected to Redis successfully');
    });

    redis.on('error', (err) => {
        logger.error(err, 'Redis connection error');
    });
} else {
    if (isProduction) {
        logger.error('FATAL: REDIS_URL not provided in production. Security layers (Denylist, Rate Limits) are CRIPPLED.');
    } else {
        logger.warn('REDIS_URL not provided, falling back to in-memory store for development.');
    }
}

// Simple in-memory fallback map if Redis is not available
const memoryStore = new Map<string, number>();

export const blockToken = async (jti: string, expiresAtUnix: number): Promise<void> => {
    const ttlSeconds = Math.max(0, expiresAtUnix - Math.floor(Date.now() / 1000));
    if (ttlSeconds <= 0) return;

    if (redis && redis.status === 'ready') {
        await redis.set(`denylist:${jti}`, '1', 'EX', ttlSeconds);
    } else {
        if (isProduction) {
            logger.error('CRITICAL: Failed to block token in Redis (Production)');
            // In production, we don't fall back to memory because it wouldn't work across nodes
            return;
        }
        memoryStore.set(`denylist:${jti}`, Date.now() + (ttlSeconds * 1000));
    }
};

export const isTokenBlocked = async (jti: string): Promise<boolean> => {
    if (redis && redis.status === 'ready') {
        const result = await redis.get(`denylist:${jti}`);
        return result === '1';
    } else {
        if (isProduction) {
            // If Redis is down in production, we assume tokens are NOT blocked (fail-open) 
            // OR we fail-close for extreme security. For this app, fail-open is safer for UX.
            return false;
        }
        const expiry = memoryStore.get(`denylist:${jti}`);
        if (!expiry) return false;
        if (Date.now() > expiry) {
            memoryStore.delete(`denylist:${jti}`);
            return false;
        }
        return true;
    }
};

export default redis;
