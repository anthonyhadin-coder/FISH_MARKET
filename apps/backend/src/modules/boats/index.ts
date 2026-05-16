import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';

const createBoatSchema = z.object({
    body: z.object({
        name: z.string().min(1),
    })
});

const requestLinkSchema = z.object({
    body: z.object({
        boatId: z.number(),
    })
});

const approveLinkSchema = z.object({
    body: z.object({
        boatId: z.number(),
        agentId: z.number(),
        action: z.enum(['approve', 'reject']),
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

export const createBoat = catchAsync(async (req: AuthRequest, res: Response) => {
    const { name } = req.body;
    const ownerId = req.user?.userId;
    
    const [result]: any[] = await pool.query(
        'INSERT INTO boats (name, owner_id, status) VALUES (?, ?, ?)',
        [name, ownerId, 'active']
    );
    res.status(201).json({ id: result.insertId, name, ownerId, status: 'active' });
});

export const findOwner = catchAsync(async (req: AuthRequest, res: Response) => {
    const { contact } = req.query as { contact: string };
    if (!contact) return res.status(400).json({ message: 'Contact is required' });

    const [owners]: any[] = await pool.query(
        `SELECT id, name, phone, email FROM users 
         WHERE role = 'owner' AND (phone = ? OR email = ?)`,
        [contact, contact]
    );

    if (owners.length === 0) {
        return res.status(404).json({ message: 'Owner not found' });
    }

    const owner = owners[0];
    const [boats]: any[] = await pool.query(
        'SELECT id, name, status, agent_id FROM boats WHERE owner_id = ?',
        [owner.id]
    );

    const maskPhone = (phone: string) =>
        phone ? phone.replace(/(\d{2})\d+(\d{2})$/, '$1XXXXXX$2') : '';

    res.json({
        owner: {
            ...owner,
            phone: maskPhone(owner.phone || '')
        },
        boats
    });
});

export const requestBoatLink = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId } = req.body;
    const agentId = req.user?.userId;

    const [boats]: any[] = await pool.query('SELECT id, status, agent_id FROM boats WHERE id = ?', [boatId]);
    if (boats.length === 0) return res.status(404).json({ message: 'Boat not found' });

    const boat = boats[0];
    if (boat.status === 'active' && boat.agent_id) {
        return res.status(400).json({ message: 'Boat is already managed by another agent' });
    }

    await pool.query(
        'UPDATE boats SET status = ?, requested_by = ? WHERE id = ?',
        ['pending', agentId, boatId]
    );

    res.json({ message: 'Request sent to owner' });
});

export const approveBoatLink = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, agentId, action } = req.body;
    const ownerId = req.user?.userId;

    const [boats]: any[] = await pool.query(
        'SELECT id FROM boats WHERE id = ? AND owner_id = ? AND requested_by = ?',
        [boatId, ownerId, agentId]
    );

    if (boats.length === 0) {
        return res.status(404).json({ message: 'Pending request not found' });
    }

    if (action === 'approve') {
        await pool.query(
            'UPDATE boats SET agent_id = ?, status = ?, requested_by = NULL WHERE id = ?',
            [agentId, 'active', boatId]
        );
    } else {
        await pool.query(
            'UPDATE boats SET status = ?, requested_by = NULL WHERE id = ?',
            ['active', boatId] // Revert to active (unassigned) if rejected
        );
    }

    res.json({ message: `Boat successfully ${action}d` });
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
        queryStr += " WHERE (b.agent_id = ? AND b.status = 'active') OR b.requested_by = ?";
        queryParams.push(userId, userId);
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
    } else if (role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const [rows]: any = await pool.query(verifyQuery, params);
    if (rows.length === 0) {
        return res.status(404).json({ message: 'Boat not found or not yours' });
    }

    await pool.query('DELETE FROM boats WHERE id = ?', [id]);
    res.json({ message: 'Boat deleted successfully' });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const router = Router();

router.post('/', authenticate, authorize(['owner']), validate(createBoatSchema), createBoat);
router.get('/', authenticate, getBoats);
router.get('/find-owner', authenticate, authorize(['agent']), findOwner);
router.post('/request-link', authenticate, authorize(['agent']), validate(requestLinkSchema), requestBoatLink);
router.post('/approve-link', authenticate, authorize(['owner']), validate(approveLinkSchema), approveBoatLink);
router.post('/expense', authenticate, authorize(['agent']), validate(addExpenseSchema), addExpense);
router.delete('/:id', authenticate, authorize(['owner']), deleteBoat);

export default router;
