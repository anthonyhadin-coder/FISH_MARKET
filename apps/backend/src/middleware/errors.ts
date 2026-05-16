import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

import { AppError } from '../utils/AppError';

export const errorHandler = (err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
    const isAppError = err instanceof AppError;
    const statusCode = isAppError ? (err as AppError).statusCode : 500;
    const errorCode = isAppError ? (err as AppError).errorCode : 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'Internal Server Error';

    const errorPayload = {
        message: err.message,
        errorCode,
        stack: err.stack,
        route: req.originalUrl,
        method: req.method,
        userId: (req as any).user?.userId,
        bodySize: req.headers['content-length'],
    };

    if (statusCode >= 500) {
        (req.log || logger).error(errorPayload);
    } else {
        (req.log || logger).warn(errorPayload);
    }

    res.status(statusCode).json({
        status: 'error',
        errorCode,
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
