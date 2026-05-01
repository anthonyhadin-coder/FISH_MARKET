import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';

const createStaffSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        phone: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
    })
});

const paySalarySchema = z.object({
    body: z.object({
        staff_id: z.union([z.string(), z.number()]),
        amount: z.number().positive(),
        note: z.string().optional().nullable(),
        date: z.string().optional().nullable(),
    })
});

export const getSalaries = catchAsync(async (req: AuthRequest, res: Response) => {
    const [rows]: any = await pool.query('SELECT * FROM staff WHERE owner_id = ? AND active = TRUE', [req.user?.userId]);
    res.json(rows);
});

export const createStaff = catchAsync(async (req: AuthRequest, res: Response) => {
    const { name, phone, role } = req.body;
    const [result]: any = await pool.query(
        'INSERT INTO staff (owner_id, name, phone, role) VALUES (?, ?, ?, ?)',
        [req.user?.userId, name, phone || null, role || null]
    );
    res.status(201).json({ id: result.insertId, name, phone, role });
});

export const deleteStaff = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await pool.query('UPDATE staff SET active = FALSE WHERE id = ? AND owner_id = ?', [id, req.user?.userId]);
    res.json({ message: 'Staff deactivated' });
});

export const paySalary = catchAsync(async (req: AuthRequest, res: Response) => {
    const { staff_id, amount, note, date } = req.body;
    const [staff]: any = await pool.query('SELECT id FROM staff WHERE id = ? AND owner_id = ?', [staff_id, req.user?.userId]);
    if (staff.length === 0) return res.status(403).json({ message: 'Forbidden' });

    await pool.query(
        'INSERT INTO staff_salaries (staff_id, amount, note, date) VALUES (?, ?, ?, ?)',
        [staff_id, amount, note || null, date || new Date()]
    );
    res.status(201).json({ message: 'Salary recorded' });
});

export const getSalaryHistory = catchAsync(async (req: AuthRequest, res: Response) => {
    const [rows]: any = await pool.query(`
        SELECT ss.*, s.name as staff_name, s.role as staff_role
        FROM staff_salaries ss
        JOIN staff s ON ss.staff_id = s.id
        WHERE s.owner_id = ?
        ORDER BY ss.date DESC, ss.id DESC
    `, [req.user?.userId]);
    res.json(rows);
});

export const getSalarySummary = catchAsync(async (req: AuthRequest, res: Response) => {
    const { date } = req.query;
    let queryStr = `
        SELECT SUM(ss.amount) as totalSalaries
        FROM staff_salaries ss
        JOIN staff s ON ss.staff_id = s.id
        WHERE s.owner_id = ?
    `;
    const params: any[] = [req.user?.userId];

    if (date) {
        queryStr += " AND ss.date = ?";
        params.push(date);
    }

    const [rows]: any = await pool.query(queryStr, params);
    res.json({ totalSalaries: Number(rows[0]?.totalSalaries || 0) });
});

const router = Router();
router.get('/staff', authenticate, authorize(['owner']), getSalaries);
router.post('/staff', authenticate, authorize(['owner']), validate(createStaffSchema), createStaff);
router.delete('/staff/:id', authenticate, authorize(['owner']), deleteStaff);
router.post('/pay', authenticate, authorize(['owner']), validate(paySalarySchema), paySalary);
router.get('/history', authenticate, authorize(['owner']), getSalaryHistory);
router.get('/summary', authenticate, authorize(['owner']), getSalarySummary);

export default router;
