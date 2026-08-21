import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: (...args: any[]) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
};
