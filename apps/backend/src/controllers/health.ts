import { Request, Response } from 'express';
import pool from '../config/db';
import redis from '../config/redis';
import { logger } from '../utils/logger';

export const checkHealth = async (req: Request, res: Response) => {
    const healthStatus: any = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        status: 'OK',
        dependencies: {
            mysql: 'UNKNOWN',
            redis: 'UNKNOWN'
        }
    };

    let isHealthy = true;

    // Check MySQL
    try {
        await pool.query('SELECT 1');
        healthStatus.dependencies.mysql = 'OK';
    } catch (err: any) {
        healthStatus.dependencies.mysql = 'DOWN';
        healthStatus.status = 'DEGRADED';
        isHealthy = false;
        logger.error({ message: 'HealthCheck: MySQL failed', error: err.message });
    }

    // Check Redis
    try {
        if (redis && redis.status === 'ready') {
            await redis.ping();
            healthStatus.dependencies.redis = 'OK';
        } else {
            // Redis fallback to in-memory mode is allowed, so we don't strictly fail healthcheck
            healthStatus.dependencies.redis = 'UNAVAILABLE_FALLBACK';
        }
    } catch (err: any) {
        healthStatus.dependencies.redis = 'DOWN';
        // Depending on strictness, we might or might not set isHealthy = false.
        // For now, if Redis crashes entirely, mark degraded.
        healthStatus.status = 'DEGRADED';
        isHealthy = false;
        logger.error({ message: 'HealthCheck: Redis failed', error: err.message });
    }

    if (!isHealthy) {
        return res.status(503).json(healthStatus);
    }

    res.status(200).json(healthStatus);
};
