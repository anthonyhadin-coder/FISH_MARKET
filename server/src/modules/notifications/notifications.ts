import { Response, Router } from 'express';
import pool from '../../core/db';
import { authenticate, AuthRequest } from '../../core/auth';
import { catchAsync } from '../../core/errors';
import { sendPushToUser } from '../../services/push.service';
import { z } from 'zod';

/**
 * Helper to create a notification internally.
 */
export async function createNotification(
    userId: number,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    notificationType: string = 'general',
    deepLink?: string
) {
    try {
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, notification_type, deep_link) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, title, message, type, notificationType, deepLink || null]
        );
        
        // Optionally trigger push immediately if applicable
        // await sendPushToUser(userId, { title, body: message, type: notificationType, url: deepLink });
    } catch (err) {
        console.error('Failed to create notification for user', userId, err);
    }
}

/**
 * GET /api/notifications
 */
export const getMyNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [notifications]: any = await pool.query(
        'SELECT id, title, message, type, is_read as "read", notification_type, deep_link, timestamp FROM notifications WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
        [userId]
    );

    const [unreadCount]: any = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
    );

    res.json({
        notifications,
        unread_count: unreadCount[0].count
    });
});

/**
 * POST /api/notifications/subscribe
 */
const subscribeSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string()
    }),
    device_info: z.string().optional()
});

export const subscribe = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid subscription data' });

    const { endpoint, keys, device_info } = parsed.data;

    await pool.query(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_info)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            is_active = TRUE,
            updated_at = NOW()
    `, [userId, endpoint, keys.p256dh, keys.auth, device_info || null]);

    res.json({ success: true, message: 'Push subscription saved' });
});

/**
 * DELETE /api/notifications/unsubscribe
 */
export const unsubscribe = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { endpoint } = req.body;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await pool.query(
        'UPDATE push_subscriptions SET is_active = FALSE WHERE user_id = ? AND endpoint = ?',
        [userId, endpoint]
    );

    res.json({ success: true });
});

/**
 * PATCH /api/notifications/:id/read
 */
export const markRead = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ message: 'Marked as read' });
});

/**
 * PATCH /api/notifications/read-all
 */
export const markAllRead = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
    res.json({ message: 'All marked as read' });
});

// ─── Router Setup ────────────────────────────────────────────────────────────

const router = Router();

router.get('/', authenticate, getMyNotifications);
router.post('/subscribe', authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

export default router;
