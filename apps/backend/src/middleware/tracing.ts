import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
    namespace Express {
        interface Request {
            id: string;
            log?: any;
        }
    }
}

export const requestTracing = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.id = requestId as string;
    res.setHeader('x-request-id', req.id);
    next();
};
