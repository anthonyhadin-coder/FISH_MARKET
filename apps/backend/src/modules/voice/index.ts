import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '@fishmarket/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';
import multer from 'multer';
import { validateAudioFile } from '../../utils/audioValidator';
import { logger } from '../../utils/logger';
import { aiService } from '../../services/ai.service';

// BUG-006 FIX: Set fileSize limit at multer level — prevents OOM from oversized uploads.
// The 25MB cap accommodates real 20-30 min boat session recordings at Opus quality.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES },
});

const saveVoiceLogSchema = z.object({
    body: z.object({
        transcript: z.string().min(1),
        parsedData: z.any().optional(),
    })
});

export const saveVoiceLog = catchAsync(async (req: AuthRequest, res: Response) => {
    const { transcript, parsedData } = req.body;
    const agentId = req.user?.userId;

    const [result]: any[] = await pool.query(
        'INSERT INTO voice_logs (agent_id, transcript, parsed_data) VALUES (?, ?, ?)',
        [agentId || null, transcript, JSON.stringify(parsedData || null)]
    );

    res.status(201).json({
        id: result.insertId,
        message: 'Voice log saved successfully'
    });
});

export const getVoiceLogs = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;

    let queryStr = 'SELECT v.*, u.name as agent_name FROM voice_logs v LEFT JOIN users u ON v.agent_id = u.id';
    const queryParams: any[] = [];

    if (role === 'agent' && agentId) {
        queryStr += ' WHERE v.agent_id = ?';
        queryParams.push(agentId);
    }

    queryStr += ' ORDER BY v.created_at DESC';

    const [logs]: any = await pool.query(queryStr, queryParams);
    res.json(logs);
});

export const transcribeAudio = catchAsync(async (req: AuthRequest, res: Response) => {
    const file = (req as any).file;
    
    if (!file) {
        return res.status(400).json({ message: 'No audio file provided' });
    }

    logger.info(`Transcription requested: type=${file.mimetype}, size=${file.size} bytes`);

    const parsedData = await aiService.transcribeAndParseAudio(file.buffer, file.mimetype);

    res.json({ 
        transcript: parsedData.transcript, 
        isSale: parsedData.isSale,
        saleDetails: parsedData.saleDetails,
        source: process.env.GEMINI_API_KEY ? 'gemini-2.5-flash' : 'mock-fallback'
    });
});

const router = Router();
router.post('/', authenticate, validate(saveVoiceLogSchema), saveVoiceLog);
router.get('/', authenticate, authorize(['owner', 'agent']), getVoiceLogs);
router.post('/transcribe', authenticate, upload.single('audio'), validateAudioFile, transcribeAudio);

export default router;
