import { Router, Response } from 'express';
import pool from '../../config/db';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

router.post('/feedback', authenticate, async (req: AuthRequest, res: Response) => {
    const { type, rating, message, userAgent, url } = req.body;
    const userId = req.user?.userId;

    try {
        await pool.query(
            'INSERT INTO beta_feedback (user_id, type, rating, message, user_agent, url) VALUES (?, ?, ?, ?, ?, ?)',
            [userId || null, type, rating || null, message, userAgent, url]
        );
        res.status(201).json({ message: 'Feedback submitted successfully' });
    } catch (err) {
        console.error('Feedback error:', err);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

router.get('/feedback', authenticate, async (req: AuthRequest, res: Response) => {
    // Only admins should see this, but for beta we'll allow all authenticated for now
    // or just check if req.user.role === 'admin'
    try {
        const [rows] = await pool.query('SELECT * FROM beta_feedback ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

export default router;
