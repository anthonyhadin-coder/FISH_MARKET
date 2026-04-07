import { Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../../core/db';
import { authenticate, authorize, AuthRequest } from '../../core/auth';
import { catchAsync } from '../../core/errors';
import { validate } from '../../core/validation';

const getAllUsersSchema = z.object({
    query: z.object({
        role: z.string().optional(),
    })
});

const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        phone: z.string().min(10),
        role: z.enum(['admin', 'owner', 'agent']),
        password: z.string().min(6),
    })
});

const deleteUserSchema = z.object({
    params: z.object({
        id: z.string(),
    })
});

const updateBoatSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        name: z.string().min(1).optional(),
        agentId: z.union([z.string(), z.number()]).optional().nullable(),
        status: z.enum(['active', 'inactive', 'maintenance']).optional(),
    })
});

const deleteBoatSchema = z.object({
    params: z.object({
        id: z.string(),
    })
});

const getBoatWeeklyReportSchema = z.object({
    query: z.object({
        boatId: z.string(),
    })
});

const getBoatMonthlyReportSchema = z.object({
    query: z.object({
        boatId: z.string(),
        year: z.string().regex(/^\d{4}$/),
        month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
    })
});

const getBoatYearlyReportSchema = z.object({
    query: z.object({
        boatId: z.string(),
        year: z.string().regex(/^\d{4}$/),
    })
});

const getAllReportsSchema = z.object({
    query: z.object({
        date: z.string().optional(),
    })
});

// ─── Controller Logic ───────────────────────────────────────────────────────

export const getAllUsers = catchAsync(async (req: AuthRequest, res: Response) => {
    const { role } = req.query;
    let query = 'SELECT id, name, phone, role, created_at FROM users';
    const params: any[] = [];
    if (role) {
        query += ' WHERE role = ?';
        params.push(role);
    }
    query += ' ORDER BY created_at DESC';
    const [users]: any[] = await pool.query(query, params);
    res.json(users);
});

export const createUser = catchAsync(async (req: AuthRequest, res: Response) => {
    const { name, phone, role, password } = req.body;
    const [existing]: any = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
        return res.status(409).json({ message: 'A user with this phone number already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result]: any = await pool.query(
        'INSERT INTO users (name, phone, role, password_hash) VALUES (?, ?, ?, ?)',
        [name, phone, role, hashedPassword]
    );
    res.status(201).json({ id: result.insertId, name, phone, role });
});

export const deleteUser = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    // Prevent owner from deleting themselves
    if (String(req.user?.userId) === String(id)) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
});

export const getAllBoatsAdmin = catchAsync(async (req: AuthRequest, res: Response) => {
    const [boats]: any = await pool.query(`
        SELECT 
            b.id, b.name,
            b.owner_id, b.agent_id, b.status,
            o.name AS owner_name,
            o.phone AS owner_phone,
            a.name AS agent_name,
            a.phone AS agent_phone
        FROM boats b
        LEFT JOIN users o ON b.owner_id = o.id
        LEFT JOIN users a ON b.agent_id = a.id
        WHERE b.owner_id = ?
        ORDER BY b.id DESC
    `, [req.user?.userId]);
    res.json(boats);
});

export const updateBoat = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, agentId, status } = req.body;
    await pool.query(
        'UPDATE boats SET name = COALESCE(?, name), agent_id = ?, status = COALESCE(?, status) WHERE id = ?',
        [name || null, agentId || null, status || null, id]
    );
    const [updated]: any = await pool.query(`
        SELECT b.id, b.name, b.owner_id, b.agent_id, b.status,
               o.name AS owner_name, a.name AS agent_name
        FROM boats b
        LEFT JOIN users o ON b.owner_id = o.id
        LEFT JOIN users a ON b.agent_id = a.id
        WHERE b.id = ?
    `, [id]);
    res.json(updated[0]);
});

export const deleteBoat = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await pool.query('DELETE FROM boats WHERE id = ?', [id]);
    res.json({ message: 'Boat deleted successfully' });
});

export const getBoatWeeklyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId } = req.query;

    const [boatRows]: any = await pool.query('SELECT name FROM boats WHERE id = ? AND owner_id = ?', [boatId, req.user?.userId]);
    if (boatRows.length === 0) return res.status(404).json({ message: 'Boat not found' });

    // Fetch last 7 days aggregation for this specific boat
    const [rows]: any = await pool.query(`
        SELECT 
            d.date,
            COALESCE(s.sales, 0) AS sales,
            COALESCE(e.expenses, 0) AS expenses,
            COALESCE(p.payments, 0) AS payments
        FROM (
            SELECT CURDATE() - INTERVAL (n.n) DAY AS date
            FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) n
        ) d
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(total) as sales 
            FROM sales WHERE boat_id = ? GROUP BY DATE(date)
        ) s ON s.date = d.date
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(amount) as expenses 
            FROM expenses WHERE boat_id = ? GROUP BY DATE(date)
        ) e ON e.date = d.date
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(amount) as payments 
            FROM boat_payments WHERE boat_id = ? GROUP BY DATE(date)
        ) p ON p.date = d.date
        ORDER BY d.date DESC
    `, [boatId, boatId, boatId]);

    const history = rows.map((r: any) => ({
        date: r.date,
        sales: Number(r.sales),
        expenses: Number(r.expenses),
        payments: Number(r.payments),
        profit: Number(r.sales) - Number(r.expenses)
    }));

    res.json({
        boatId,
        boatName: boatRows[0].name,
        history
    });
});

export const getBoatMonthlyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, year, month } = req.query;

    const [boatRows]: any = await pool.query('SELECT name FROM boats WHERE id = ? AND owner_id = ?', [boatId, req.user?.userId]);
    if (boatRows.length === 0) return res.status(404).json({ message: 'Boat not found' });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const [rows]: any = await pool.query(`
        SELECT 
            DATE(s.date) as date,
            SUM(s.total) as sales,
            COALESCE(e.expenses, 0) as expenses,
            COALESCE(p.payments, 0) as payments
        FROM sales s
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(amount) as expenses 
            FROM expenses WHERE boat_id = ? GROUP BY DATE(date)
        ) e ON e.date = DATE(s.date)
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(amount) as payments 
            FROM boat_payments WHERE boat_id = ? GROUP BY DATE(date)
        ) p ON p.date = DATE(s.date)
        WHERE s.boat_id = ? AND s.date BETWEEN ? AND ?
        GROUP BY DATE(s.date)
        ORDER BY s.date DESC
    `, [boatId, boatId, boatId, startDate, endDate]);

    const history = rows.map((r: any) => ({
        date: r.date,
        sales: Number(r.sales),
        expenses: Number(r.expenses),
        payments: Number(r.payments),
        profit: Number(r.sales) - Number(r.expenses)
    }));

    res.json({ boatId, boatName: boatRows[0].name, year, month, history });
});

export const getBoatYearlyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, year } = req.query;

    const [boatRows]: any = await pool.query('SELECT name FROM boats WHERE id = ? AND owner_id = ?', [boatId, req.user?.userId]);
    if (boatRows.length === 0) return res.status(404).json({ message: 'Boat not found' });

    const [rows]: any = await pool.query(`
        SELECT 
            MONTH(date) as month,
            SUM(total) as sales,
            (SELECT SUM(amount) FROM expenses WHERE boat_id = ? AND YEAR(date) = ? AND MONTH(date) = MONTH(s.date)) as expenses,
            (SELECT SUM(amount) FROM boat_payments WHERE boat_id = ? AND YEAR(date) = ? AND MONTH(date) = MONTH(s.date)) as payments
        FROM sales s
        WHERE boat_id = ? AND YEAR(date) = ?
        GROUP BY MONTH(date)
        ORDER BY month ASC
    `, [boatId, year, boatId, year, boatId, year]);

    const history = rows.map((r: any) => ({
        month: Number(r.month),
        sales: Number(r.sales),
        expenses: Number(r.expenses || 0),
        payments: Number(r.payments || 0),
        profit: Number(r.sales) - Number(r.expenses || 0)
    }));

    res.json({ boatId, boatName: boatRows[0].name, year, history });
});

export const getAllReports = catchAsync(async (req: AuthRequest, res: Response) => {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Per-boat breakdown for this owner
    const [rows]: any = await pool.query(`
        SELECT 
            b.id AS boat_id,
            b.name AS boat_name,
            u.name AS agent_name,
            COALESCE(s.total_sales, 0)    AS total_sales,
            COALESCE(e.total_expenses, 0) AS total_expenses,
            COALESCE(p.total_payments, 0) AS total_payments
        FROM boats b
        LEFT JOIN users u ON b.agent_id = u.id
        LEFT JOIN (
            SELECT boat_id, SUM(total) AS total_sales
            FROM sales WHERE DATE(date) = ?
            GROUP BY boat_id
        ) s ON s.boat_id = b.id
        LEFT JOIN (
            SELECT boat_id, SUM(amount) AS total_expenses
            FROM expenses WHERE DATE(date) = ?
            GROUP BY boat_id
        ) e ON e.boat_id = b.id
        LEFT JOIN (
            SELECT boat_id, SUM(amount) AS total_payments
            FROM boat_payments WHERE DATE(date) = ?
            GROUP BY boat_id
        ) p ON p.boat_id = b.id
        WHERE b.owner_id = ?
        ORDER BY b.id
    `, [targetDate, targetDate, targetDate, req.user?.userId]);

    const boats = rows.map((row: any) => ({
        boatId: row.boat_id,
        boatName: row.boat_name,
        agentName: row.agent_name || '—',
        totalSales: Number(row.total_sales),
        totalExpenses: Number(row.total_expenses),
        totalPayments: Number(row.total_payments),
        cashWithAgent: Number(row.total_sales) - Number(row.total_payments),
        profit: Number(row.total_sales) - Number(row.total_expenses),
    }));

    const summary = boats.reduce((acc: any, b: any) => ({
        totalSales: acc.totalSales + b.totalSales,
        totalExpenses: acc.totalExpenses + b.totalExpenses,
        totalPayments: acc.totalPayments + b.totalPayments,
        totalProfit: acc.totalProfit + b.profit,
    }), { totalSales: 0, totalExpenses: 0, totalPayments: 0, totalProfit: 0 });

    res.json({ date: targetDate, summary, boats });
});

export const getFleetWeeklyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    // Fetch last 7 days aggregation for the entire fleet owned by this user
    const [rows]: any = await pool.query(`
        SELECT 
            d.date,
            COALESCE(SUM(s.sales), 0) AS sales,
            COALESCE(SUM(e.expenses), 0) AS expenses
        FROM (
            SELECT CURDATE() - INTERVAL (n.n) DAY AS date
            FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) n
        ) d
        CROSS JOIN (SELECT id FROM boats WHERE owner_id = ?) b
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(total) as sales, boat_id
            FROM sales GROUP BY DATE(date), boat_id
        ) s ON s.date = d.date AND s.boat_id = b.id
        LEFT JOIN (
            SELECT DATE(date) as date, SUM(amount) as expenses, boat_id
            FROM expenses GROUP BY DATE(date), boat_id
        ) e ON e.date = d.date AND e.boat_id = b.id
        GROUP BY d.date
        ORDER BY d.date ASC
    `, [req.user?.userId]);

    const history = rows.map((r: any) => ({
        date: r.date,
        sales: Number(r.sales),
        expenses: Number(r.expenses),
        profit: Number(r.sales) - Number(r.expenses)
    }));

    res.json(history);
});

const router = Router();
router.use(authenticate, authorize(['owner']));

router.get('/users', validate(getAllUsersSchema), getAllUsers);
router.post('/users', validate(createUserSchema), createUser);
router.delete('/users/:id', validate(deleteUserSchema), deleteUser);

router.get('/boats', getAllBoatsAdmin);
router.put('/boats/:id', validate(updateBoatSchema), updateBoat);
router.delete('/boats/:id', validate(deleteBoatSchema), deleteBoat);

router.get('/reports', validate(getAllReportsSchema), getAllReports);
router.get('/reports/boat-weekly', validate(getBoatWeeklyReportSchema), getBoatWeeklyReport);
router.get('/reports/boat-monthly', validate(getBoatMonthlyReportSchema), getBoatMonthlyReport);
router.get('/reports/boat-yearly', validate(getBoatYearlyReportSchema), getBoatYearlyReport);
router.get('/reports/fleet-weekly', getFleetWeeklyReport);

export default router;
