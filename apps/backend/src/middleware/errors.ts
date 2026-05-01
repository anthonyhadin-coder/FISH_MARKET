import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
    statusCode?: number;
}

export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    logger.error(`${req.method} ${req.url} - ${message}`, err);

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: process.env.NODE_ENV === 'production' && statusCode === 500 
            ? 'Internal Server Error' 
            : message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export const catchAsync = (fn: (...args: any[]) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
};
