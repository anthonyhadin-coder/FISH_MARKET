import { Request, Response } from 'express';
import pool from '@fishmarket/database';
import redis from '../../config/redis';
import { logger } from '../../utils/logger';

export const checkHealth = async (req: Request, res: Response) => {
    const healthStatus: {
        uptime: number;
        memoryUsage: NodeJS.MemoryUsage;
        status: string;
        dependencies: { mysql: string; redis: string };
    } = {
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
    } catch (err: unknown) {
        healthStatus.dependencies.mysql = 'DOWN';
        healthStatus.status = 'DEGRADED';
        isHealthy = false;
        logger.error({ message: 'HealthCheck: MySQL failed', error: err instanceof Error ? err.message : err });
    }

    // Check Redis
    try {
        if (redis && redis.status === 'ready') {
            await redis.ping();
            healthStatus.dependencies.redis = 'OK';
        } else {
            healthStatus.dependencies.redis = 'UNAVAILABLE_FALLBACK';
        }
    } catch (err: unknown) {
        healthStatus.dependencies.redis = 'DOWN';
        healthStatus.status = 'DEGRADED';
        isHealthy = false;
        logger.error({ message: 'HealthCheck: Redis failed', error: err instanceof Error ? err.message : err });
    }

    if (!isHealthy) {
        return res.status(503).json(healthStatus);
    }

    res.status(200).json(healthStatus);
};
