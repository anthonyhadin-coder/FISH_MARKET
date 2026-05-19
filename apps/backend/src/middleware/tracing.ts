import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface TracedRequest extends Request {
    id: string;
}

export const requestTracing = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    (req as TracedRequest).id = requestId as string;
    res.setHeader('x-request-id', (req as TracedRequest).id);
    next();
};
