import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Rate limiting for transcription: max 10 requests per minute per user
export const transcribeRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many transcription requests, please wait a minute.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.userId || req.ip
});

export const validateAudioFile = (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file;
    if (!file) {
        return res.status(400).json({ message: 'No audio file provided' });
    }

    // 1. Max file size: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return res.status(400).json({ message: 'Audio file too large (max 5MB)' });
    }

    // 2. MIME type check: audio/webm or audio/wav (common for browser blobs)
    const ALLOWED_TYPES = ['audio/webm', 'audio/wav', 'audio/ogg', 'application/octet-stream'];
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ message: 'Invalid audio format. Only WebM/WAV supported.' });
    }

    next();
};
