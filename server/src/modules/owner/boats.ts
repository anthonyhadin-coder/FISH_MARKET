import { Request, Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../core/db';
import { authenticate, authorize, AuthRequest } from '../../core/auth';
import { catchAsync } from '../../core/errors';
import { validate } from '../../core/validation';

const createBoatSchema = z.object({
    body: z.object({
        name: z.string().min(1),
        ownerId: z.union([z.string(), z.number()]).optional().nullable(),
        agentId: z.union([z.string(), z.number()]).optional().nullable(),
    })
});

const addExpenseSchema = z.object({
    body: z.object({
        boatId: z.union([z.string(), z.number()]),
        expenseType: z.string().min(1),
        amount: z.number().positive(),
        note: z.string().optional().nullable(),
    })
});

// ─── Controller Logic ───────────────────────────────────────────────────────

export const createBoat = catchAsync(async (req: Request, res: Response) => {
    const { name, ownerId, agentId } = req.body;
    const [result]: any[] = await pool.query(
        'INSERT INTO boats (name, owner_id, agent_id) VALUES (?, ?, ?)',
        [name, ownerId || null, agentId || null]
    );
    res.status(201).json({ id: result.insertId, name, ownerId, agentId });
});

export const getBoats = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const role = req.user?.role;
    
    let queryStr = `
        SELECT b.*, u.phone AS ownerPhone 
        FROM boats b
        LEFT JOIN users u ON b.owner_id = u.id
    `;
    const queryParams: any[] = [];
    
    if (role === 'agent' && userId) {
        queryStr += ' WHERE b.agent_id = ?';
        queryParams.push(userId);
    } else if (role === 'owner' && userId) {
        queryStr += ' WHERE b.owner_id = ?';
         queryParams.push(userId);
    }

    const [boats]: any[] = await pool.query(queryStr, queryParams);
    res.json(boats);
});

export const addExpense = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, expenseType, amount, note } = req.body;
    const agentId = req.user?.userId;
    
    const [result]: any = await pool.query(
        'INSERT INTO expenses (boat_id, agent_id, expense_type, amount, note) VALUES (?, ?, ?, ?, ?)',
        [boatId, agentId || null, expenseType, amount, note || null]
    );
    
    res.status(201).json({ id: result.insertId, boatId, agentId, expenseType, amount, note });
});

export const deleteBoat = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.userId;
    const role = req.user?.role;

    let verifyQuery = 'SELECT id FROM boats WHERE id = ?';
    const params: (string | number)[] = [id];
    
    if (role === 'owner') {
        verifyQuery += ' AND owner_id = ?';
        params.push(userId!);
    } else if (role === 'agent') {
        verifyQuery += ' AND agent_id = ?';
        params.push(userId!);
    }

    const [rows]: any = await pool.query(verifyQuery, params);
    if (rows.length === 0 && role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized or boat not found' });
    }

    await pool.query('DELETE FROM boats WHERE id = ?', [id]);
    res.json({ message: 'Boat deleted successfully' });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const router = Router();

router.post('/', authenticate, authorize(['owner', 'agent']), validate(createBoatSchema), createBoat);
router.get('/', authenticate, getBoats);
router.post('/expense', authenticate, authorize(['owner', 'agent']), validate(addExpenseSchema), addExpense);
router.delete('/:id', authenticate, authorize(['owner', 'agent']), deleteBoat);

export default router;
