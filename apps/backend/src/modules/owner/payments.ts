import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
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
    const { date, boatId } = req.query;

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

    queryStr += ' ORDER BY p.time DESC';

    const [payments]: any = await pool.query(queryStr, queryParams);
    res.json(payments);
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
router.delete('/:id', authenticate, authorize(['agent', 'admin']), deleteBoatPayment);

export default router;
