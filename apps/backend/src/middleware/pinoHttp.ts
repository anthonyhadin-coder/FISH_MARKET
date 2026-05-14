import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} completed`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} failed`;
    },
    customProps: (req, res) => {
        return {
            userId: (req as any).user?.userId,
        };
    }
});
