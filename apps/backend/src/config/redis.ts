import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;

if (redisUrl) {
    redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            if (times > 3) {
                logger.warn('Redis connection failed after 3 attempts. Falling back to in-memory store.');
                return null; // Stop retrying
            }
            return delay;
        },
    });

    redis.on('connect', () => {
        logger.info('Connected to Redis successfully');
    });

    redis.on('error', (err) => {
        logger.error('Redis connection error', err);
    });
} else {
    // Graceful fallback for local development if Redis is not configured
    logger.warn('REDIS_URL not provided, falling back to in-memory store for JWT Denylist.');
}

// Simple in-memory fallback map if Redis is not available
const memoryStore = new Map<string, number>();

export const blockToken = async (jti: string, expiresAtUnix: number): Promise<void> => {
    const ttlSeconds = Math.max(0, expiresAtUnix - Math.floor(Date.now() / 1000));
    if (ttlSeconds <= 0) return;

    if (redis) {
        await redis.set(`denylist:${jti}`, '1', 'EX', ttlSeconds);
    } else {
        memoryStore.set(`denylist:${jti}`, Date.now() + (ttlSeconds * 1000));
        // Clean up memory store periodically to avoid memory leaks
        if (memoryStore.size > 10000) {
            const now = Date.now();
            for (const [key, expiry] of memoryStore.entries()) {
                if (expiry < now) memoryStore.delete(key);
            }
        }
    }
};

export const isTokenBlocked = async (jti: string): Promise<boolean> => {
    if (redis) {
        const result = await redis.get(`denylist:${jti}`);
        return result === '1';
    } else {
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
