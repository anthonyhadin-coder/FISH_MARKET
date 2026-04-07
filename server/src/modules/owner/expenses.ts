import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../core/db';
import { authenticate, authorize, AuthRequest } from '../../core/auth';
import { catchAsync } from '../../core/errors';
import { validate } from '../../core/validation';

const recordExpenseSchema = z.object({
    body: z.object({
        boatId: z.union([z.string(), z.number()]),
        expenseType: z.string().min(1),
        amount: z.number().positive(),
        note: z.string().optional().nullable(),
    })
});

const round = (val: number) => Math.round(val * 100) / 100;

// ─── Controller Logic ───────────────────────────────────────────────────────

export const recordExpense = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, expenseType, amount, note } = req.body;
    const agentId = req.user?.userId;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const amountRounded = round(amount);

    const [result]: any[] = await pool.query(
        'INSERT INTO expenses (boat_id, agent_id, expense_type, amount, note) VALUES (?, ?, ?, ?, ?)',
        [boatId, agentId, expenseType, amountRounded, note || null]
    );

    res.status(201).json({
        id: result.insertId,
        boatId,
        agentId,
        expenseType,
        amount,
        note
    });
});

export const getExpenses = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { date, boatId } = req.query;

    let queryStr = 'SELECT e.*, b.name as boat_name FROM expenses e LEFT JOIN boats b ON e.boat_id = b.id WHERE 1=1';
    const queryParams: any[] = [];

    if (role === 'agent' && agentId) {
        queryStr += ' AND e.agent_id = ?';
        queryParams.push(agentId);
    } else if (role === 'owner' && agentId) {
        queryStr += ' AND b.owner_id = ?';
        queryParams.push(agentId);
    }

    if (date) {
        queryStr += ' AND e.date = ?';
        queryParams.push(date);
    } else {
        queryStr += ' AND e.date = CURRENT_DATE';
    }

    if (boatId) {
        queryStr += ' AND e.boat_id = ?';
        queryParams.push(boatId);
    }

    queryStr += ' ORDER BY e.time DESC';

    const [expenses]: any = await pool.query(queryStr, queryParams);
    res.json(expenses);
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const router = Router();

router.post('/', authenticate, authorize(['agent', 'owner']), validate(recordExpenseSchema), recordExpense);
router.get('/', authenticate, getExpenses);

export default router;
