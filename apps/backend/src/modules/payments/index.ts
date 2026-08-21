import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '@fishmarket/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';

const recordBoatPaymentSchema = z.object({
    body: z.object({
        boatId: z.union([z.string(), z.number()]),
        amount: z.number().positive(),
        paymentMethod: z.string().optional().default('cash'),
    })
});

// ─── Controller Logic ───────────────────────────────────────────────────────

export const recordBoatPayment = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, amount, paymentMethod } = req.body;
    const agentId = req.user?.userId;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const [result]: any[] = await pool.query(
        'INSERT INTO boat_payments (boat_id, agent_id, amount, payment_method) VALUES (?, ?, ?, ?)',
        [boatId, agentId, amount, paymentMethod || 'cash']
    );

    res.status(201).json({
        id: result.insertId,
        boatId,
        agentId,
        amount,
        paymentMethod: paymentMethod || 'cash'
    });
});

export const getBoatPayments = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { date, boatId, limit: rawLimit, cursor } = req.query;

    // PHASE 8 — Pagination: optional limit/cursor (backward-compatible defaults)
    const limit = Math.min(parseInt(rawLimit as string) || 200, 500);

    let queryStr = 'SELECT p.*, b.name as boat_name FROM boat_payments p LEFT JOIN boats b ON p.boat_id = b.id WHERE 1=1';
    const queryParams: any[] = [];

    if (role === 'agent' && agentId) {
        queryStr += ' AND p.agent_id = ?';
        queryParams.push(agentId);
    } else if (role === 'owner' && agentId) {
        queryStr += ' AND b.owner_id = ?';
        queryParams.push(agentId);
    }

    if (date) {
        queryStr += ' AND p.date = ?';
        queryParams.push(date);
    } else {
        queryStr += ' AND p.date = CURRENT_DATE';
    }

    if (boatId) {
        queryStr += ' AND p.boat_id = ?';
        queryParams.push(boatId);
    }

    if (cursor) {
        queryStr += ' AND p.id < ?';
        queryParams.push(cursor);
    }

    const isPaginated = rawLimit !== undefined || cursor !== undefined;
    queryStr += ' ORDER BY p.date DESC, p.time DESC, p.id DESC';
    
    if (isPaginated) {
        queryStr += ' LIMIT ?';
        queryParams.push(limit);
    } else {
        queryStr += ' LIMIT 200';
    }

    const [payments]: any = await pool.query(queryStr, queryParams);
    
    if (isPaginated) {
        const lastId = payments.length > 0 ? payments[payments.length - 1].id : null;
        return res.json({
            data: payments,
            pagination: {
                limit,
                nextCursor: payments.length === limit ? lastId : null,
                hasMore: payments.length === limit,
            }
        });
    }

    res.json(payments);
});

// BUG-007 FIX: Single-query range endpoint replaces N+1 per-day calls in WeeklySettlementSlip
export const getBoatPaymentsRange = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { boatId, startDate, endDate } = req.query;

    if (!boatId || !startDate || !endDate) {
        return res.status(400).json({ message: 'boatId, startDate, and endDate are required' });
    }

    let queryStr = `
        SELECT 
            DATE(p.date) AS date,
            SUM(p.amount) AS total_advances,
            COUNT(*) AS payment_count
        FROM boat_payments p
        WHERE p.boat_id = ?
          AND p.date BETWEEN ? AND ?
    `;
    const queryParams: any[] = [boatId, startDate, endDate];

    if (role === 'agent' && agentId) {
        queryStr += ' AND p.agent_id = ?';
        queryParams.push(agentId);
    }

    queryStr += ' GROUP BY DATE(p.date) ORDER BY date ASC';

    const [rows]: any = await pool.query(queryStr, queryParams);

    // Return as { [dateString]: totalAmount } map for easy lookup in frontend
    const byDate: Record<string, number> = {};
    rows.forEach((r: any) => {
        const dateStr = typeof r.date === 'string' ? r.date.substring(0, 10) : r.date.toISOString().substring(0, 10);
        byDate[dateStr] = parseFloat(r.total_advances);
    });

    res.json(byDate);
});

export const deleteBoatPayment = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { id } = req.params;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const [rows]: any = await pool.query('SELECT id, agent_id FROM boat_payments WHERE id = ?', [id]);
    if (rows.length === 0) {
        return res.status(404).json({ message: 'Payment not found' });
    }
    if (role !== 'admin' && rows[0].agent_id !== agentId) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    await pool.query('DELETE FROM boat_payments WHERE id = ?', [id]);
    res.json({ message: 'Payment deleted', id });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const router = Router();

router.post('/', authenticate, authorize(['agent', 'owner']), validate(recordBoatPaymentSchema), recordBoatPayment);
router.get('/', authenticate, getBoatPayments);
// BUG-007: /range must be before /:id to avoid Express treating 'range' as an ID param
router.get('/range', authenticate, getBoatPaymentsRange);
router.delete('/:id', authenticate, authorize(['agent', 'admin']), deleteBoatPayment);

export default router;
