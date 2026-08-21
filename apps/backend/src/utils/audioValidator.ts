import { Request, Response, NextFunction } from 'express';
// Rate limiting is handled centrally by voiceRateLimit in middleware/rateLimiter.ts
export const validateAudioFile = (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file;
    if (!file) {
        return res.status(400).json({ message: 'No audio file provided' });
    }

    // BUG-009 FIX: 25MB — real 20-30 min Opus recordings need up to 25MB.
    // Multer enforces this at the HTTP layer (voice/index.ts); this is a belt-and-suspenders guard.
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return res.status(400).json({ message: 'Audio file too large (max 25MB)' });
    }

    // 2. MIME type check: support broad spectrum of browser formats (WebM, WAV, MP4/AAC, OGG)
    const ALLOWED_TYPES = [
        'audio/webm', 
        'audio/wav', 
        'audio/ogg', 
        'audio/mp4', 
        'audio/mpeg', 
        'audio/aac',
        'audio/x-matroska',
        'application/octet-stream'
    ];
    if (!ALLOWED_TYPES.includes(file.mimetype) && !file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ message: `Invalid audio format: ${file.mimetype}. Only standard audio formats supported.` });
    }

    next();
};
