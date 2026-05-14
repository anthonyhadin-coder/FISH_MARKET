import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestTiming = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000;
        
        // Log slow APIs explicitly for alerting
        if (durationMs > 500) {
            (req.log || logger).warn({
                message: 'SLOW_API_DETECTED',
                route: req.originalUrl,
                method: req.method,
                durationMs: durationMs.toFixed(2)
            });
        }
        
        // pino-http already logs the completion and duration natively
    });
    
    next();
};
