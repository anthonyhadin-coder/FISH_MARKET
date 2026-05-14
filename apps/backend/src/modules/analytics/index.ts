import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { catchAsync } from '../../middleware/errors';

const router = Router();

/**
 * @route POST /api/analytics/telemetry/error
 * @desc Collects frontend errors for production diagnostics
 */
router.post('/telemetry/error', catchAsync(async (req: Request, res: Response) => {
    const { error, stack, componentStack, info, url, userAgent } = req.body;
    const requestId = req.headers['x-request-id'];

    logger.error({
        msg: 'FRONTEND_ERROR_CAPTURED',
        requestId,
        userId: (req as any).user?.userId,
        error,
        url,
        userAgent,
        stack,
        componentStack,
        info
    });

    res.status(204).send();
}));

/**
 * @route POST /api/analytics/telemetry/voice
 * @desc Tracks voice parsing accuracy and duration
 */
router.post('/telemetry/voice', catchAsync(async (req: Request, res: Response) => {
    const { 
        rawText, 
        normalizedText, 
        fishConfidence, 
        overallConfidence, 
        durationMs, 
        corrected,
        metadata 
    } = req.body;
    
    const requestId = req.headers['x-request-id'];

    logger.info({
        msg: 'VOICE_PARSING_TELEMETRY',
        requestId,
        userId: (req as any).user?.userId,
        rawText,
        normalizedText,
        fishConfidence,
        overallConfidence,
        durationMs,
        corrected,
        metadata
    });

    res.status(204).send();
}));

export default router;
