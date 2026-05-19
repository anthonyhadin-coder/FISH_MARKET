import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    const isAppError = err instanceof AppError;
    let statusCode = isAppError ? err.statusCode : (err.status || 500);
    let errorCode = isAppError ? err.errorCode : 'INTERNAL_SERVER_ERROR';
    let message = err.message || 'Internal Server Error';

    // Mask database errors to prevent leaking schema details
    const isDbError = err.sql || err.sqlState || (err.code && typeof err.code === 'string' && err.code.startsWith('ER_'));
    if (isDbError) {
        statusCode = 500;
        errorCode = 'DATABASE_ERROR';
        message = 'Unable to complete the operation at this time. Please try again.';
    }

    const errorPayload = {
        message: err.message,
        errorCode,
        stack: err.stack,
        route: req.originalUrl,
        method: req.method,
        userId: (req as any).user?.userId,
        bodySize: req.headers['content-length'],
        ...(isDbError && { sqlCode: err.code, sqlState: err.sqlState, sqlMessage: err.sqlMessage })
    };

    if (statusCode >= 500) {
        (req.log || logger).error(errorPayload);
    } else {
        (req.log || logger).warn(errorPayload);
    }

    res.status(statusCode).json({
        status: 'error',
        errorCode,
        message: process.env.NODE_ENV === 'production' && statusCode >= 500 
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
