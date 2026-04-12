import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';
import multer from 'multer';
import { validateAudioFile, transcribeRateLimiter } from '../../utils/audioValidator';

const upload = multer({ storage: multer.memoryStorage() });

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
    // Placeholder for actual AI transcription (Whisper/Google)
    // We simulate it here until API keys are provided.
    
    // Logic for Whisper API would go here:
    // const response = await openai.audio.transcriptions.create({ file: file.buffer, model: "whisper-1" });
    
    res.json({ 
        transcript: "Simulation: Voice parsing successful", 
        confidence: 0.95,
        source: 'fallback-cloud'
    });
});

const router = Router();
router.post('/', authenticate, validate(saveVoiceLogSchema), saveVoiceLog);
router.get('/', authenticate, authorize(['owner', 'agent']), getVoiceLogs);
router.post('/transcribe', authenticate, transcribeRateLimiter, upload.single('audio'), validateAudioFile, transcribeAudio);

export default router;
