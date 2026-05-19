import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => (req as any).id,
    customSuccessMessage: (req, _res) => {
        return `${req.method} ${req.url} completed`;
    },
    customErrorMessage: (req, _res, _err) => {
        return `${req.method} ${req.url} failed`;
    },
    customProps: (req, _res) => {
        return {
            userId: (req as any).user?.userId,
        };
    }
});
