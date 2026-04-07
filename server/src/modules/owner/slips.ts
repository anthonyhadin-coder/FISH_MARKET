import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';
import { createNotification } from '../notifications/notifications';

const sendSlipSchema = z.object({
    body: z.object({
        boatId: z.union([z.string(), z.number()]),
        date: z.string(),
        slipData: z.any(),
    })
});

const slipStatusSchema = z.object({
    query: z.object({
        boatId: z.string(),
        date: z.string(),
    })
});

/**
 * Send a new slip (Agent only)
 */
export const sendSlip = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, date, slipData } = req.body;
    const agentId = req.user?.userId;

    const [boats]: any = await pool.query('SELECT owner_id FROM boats WHERE id = ?', [boatId]);
    
    if (!boats || boats.length === 0) {
        return res.status(404).json({ message: 'Boat not found' });
    }

    const ownerId = boats[0].owner_id;
    
    if (!ownerId) {
        return res.status(400).json({ message: 'Boat has no owner assigned' });
    }

    const query = `
        INSERT INTO shared_slips (boat_id, agent_id, owner_id, date, slip_data, sent_at, status)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
        ON DUPLICATE KEY UPDATE
            slip_data = VALUES(slip_data),
            sent_at = CURRENT_TIMESTAMP,
            status = 'sent',
            read_at = NULL
    `;

    await pool.query(query, [boatId, agentId, ownerId, date, JSON.stringify(slipData)]);

    res.status(200).json({ message: 'Slip sent to owner successfully' });
});

/**
 * Get the status of a slip (Agent uses this to check if already sent/approved/rejected)
 */
export const getSlipStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, date } = req.query;
    const agentId = req.user?.userId;

    const [slips]: any = await pool.query(
        'SELECT status, reject_reason as rejectReason FROM shared_slips WHERE boat_id = ? AND date = ? AND agent_id = ?',
        [boatId, date, agentId]
    );

    if (!slips || slips.length === 0) {
        return res.status(200).json({ exists: false, status: null });
    }

    res.status(200).json({
        exists: true,
        status: slips[0].status,
        rejectReason: slips[0].rejectReason
    });
});

/**
 * Get all slips for the logged-in owner
 */
export const getMySlips = catchAsync(async (req: AuthRequest, res: Response) => {
    const ownerId = req.user?.userId;

    const query = `
        SELECT s.*, b.name as boatName, a.name as agentName
        FROM shared_slips s
        JOIN boats b ON s.boat_id = b.id
        JOIN users a ON s.agent_id = a.id
        WHERE s.owner_id = ?
        ORDER BY s.sent_at DESC
        LIMIT 50
    `;

    const [slips]: any = await pool.query(query, [ownerId]);
    res.status(200).json(slips);
});

/**
 * Get the count of unread slips for the owner (used for the badge)
 */
export const getUnreadCount = catchAsync(async (req: AuthRequest, res: Response) => {
    const ownerId = req.user?.userId;

    const [rows]: any = await pool.query(
        'SELECT COUNT(*) as unreadCount FROM shared_slips WHERE owner_id = ? AND status = "sent"',
        [ownerId]
    );

    res.status(200).json({ count: rows[0].unreadCount || 0 });
});

/**
 * Mark a slip as read
 */
export const markAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const ownerId = req.user?.userId;

    await pool.query(
        'UPDATE shared_slips SET status = "read", read_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?',
        [id, ownerId]
    );

    res.status(200).json({ message: 'Slip marked as read' });
});

/**
 * Owner Approves the Slip
 */
export const approveSlip = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const ownerId = req.user?.userId;

    const [slips]: any = await pool.query(
        'SELECT boat_id, agent_id FROM shared_slips WHERE id = ? AND owner_id = ?',
        [id, ownerId]
    );

    if (!slips || slips.length === 0) {
        return res.status(404).json({ message: 'Slip not found' });
    }

    await pool.query(
        'UPDATE shared_slips SET status = "approved", reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?',
        [id, ownerId]
    );

    // Notify agent
    const [boats]: any = await pool.query('SELECT name FROM boats WHERE id = ?', [slips[0].boat_id]);
    const boatName = boats?.[0]?.name || 'Boat';
    
    await createNotification(
        slips[0].agent_id,
        'Slip Approved ✅',
        `The owner has approved your slip for ${boatName}.`,
        'success'
    );

    res.status(200).json({ message: 'Slip approved successfully' });
});

/**
 * Owner Rejects the Slip
 */
const rejectSlipSchema = z.object({
    body: z.object({
        reason: z.string().min(1, 'Reason is required')
    })
});

export const rejectSlip = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const ownerId = req.user?.userId;

    const [slips]: any = await pool.query(
        'SELECT boat_id, agent_id FROM shared_slips WHERE id = ? AND owner_id = ?',
        [id, ownerId]
    );

    if (!slips || slips.length === 0) {
        return res.status(404).json({ message: 'Slip not found' });
    }

    await pool.query(
        'UPDATE shared_slips SET status = "rejected", reject_reason = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?',
        [reason, id, ownerId]
    );

    // Notify agent
    const [boats]: any = await pool.query('SELECT name FROM boats WHERE id = ?', [slips[0].boat_id]);
    const boatName = boats?.[0]?.name || 'Boat';

    await createNotification(
        slips[0].agent_id,
        'Slip Rejected ❌',
        `The owner rejected your slip for ${boatName}. Reason: ${reason}`,
        'error'
    );

    res.status(200).json({ message: 'Slip rejected successfully' });
});

// ─── Router Setup ────────────────────────────────────────────────────────────

const router = Router();

// Agent routes
router.post('/', authenticate, authorize(['agent', 'admin']), validate(sendSlipSchema), sendSlip);
router.get('/status', authenticate, authorize(['agent', 'admin']), validate(slipStatusSchema), getSlipStatus);

// Owner routes
router.get('/', authenticate, authorize(['owner', 'admin']), getMySlips);
router.get('/unread-count', authenticate, authorize(['owner', 'admin']), getUnreadCount);
router.patch('/:id/read', authenticate, authorize(['owner', 'admin']), markAsRead);
router.patch('/:id/approve', authenticate, authorize(['owner', 'admin']), approveSlip);
router.patch('/:id/reject', authenticate, authorize(['owner', 'admin']), validate(rejectSlipSchema), rejectSlip);

export default router;
