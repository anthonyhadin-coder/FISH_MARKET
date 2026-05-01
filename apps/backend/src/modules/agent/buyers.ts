import { Request, Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { validate } from '../../middleware/validation';

const createBuyerSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        phone: z.string().min(10).optional(),
    })
});

const recordBuyerPaymentSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        amount: z.number().positive(),
    })
});

export const createBuyer = catchAsync(async (req: Request, res: Response) => {
    const { name, phone } = req.body;
    const [result]: any[] = await pool.query(
        'INSERT INTO buyers (name, phone) VALUES (?, ?)',
        [name, phone || null]
    );
    res.status(201).json({ id: result.insertId, name, phone });
});

export const getBuyers = catchAsync(async (req: AuthRequest, res: Response) => {
    const [buyers]: any[] = await pool.query(`
        SELECT 
            b.id,
            b.name,
            b.phone,
            b.created_at,
            COALESCE(s.totalSales, 0) AS totalSales,
            COALESCE(p.totalPaid, 0) AS totalPaid,
            (COALESCE(s.totalSales, 0) - COALESCE(p.totalPaid, 0)) AS balance
        FROM buyers b
        LEFT JOIN (
            SELECT buyer_id, SUM(total) as totalSales 
            FROM sales 
            WHERE amount_paid = 0 OR (total > amount_paid) 
            GROUP BY buyer_id
        ) s ON s.buyer_id = b.id
        LEFT JOIN (
            SELECT buyer_id, SUM(amount_paid) as totalPaid 
            FROM buyer_transactions 
            GROUP BY buyer_id
        ) p ON p.buyer_id = b.id
        ORDER BY b.name ASC
    `);
    res.json(buyers);
});

export const getBuyerBalance = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const [buyers]: any[] = await pool.query('SELECT * FROM buyers WHERE id = ?', [id]);
    
    if (buyers.length === 0) return res.status(404).json({ message: 'Buyer not found' });
    
    const buyer = buyers[0];

    // get sales
    const [sales]: any[] = await pool.query('SELECT * FROM sales WHERE buyer_id = ?', [id]);
    // get payments
    const [transactions]: any[] = await pool.query('SELECT * FROM buyer_transactions WHERE buyer_id = ?', [id]);

    const totalSales = sales.reduce((sum: number, s: any) => sum + Number(s.total), 0);
    const totalPaid = transactions.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
    const balance = Number((totalSales - totalPaid).toFixed(2));

    res.json({ buyer, totalSales, totalPaid, balance, sales, transactions });
});

export const recordBuyerPayment = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { amount } = req.body;

    const [buyers]: any[] = await pool.query('SELECT * FROM buyers WHERE id = ?', [id]);
    if (buyers.length === 0) return res.status(404).json({ message: 'Buyer not found' });

    await pool.query(
         'INSERT INTO buyer_transactions (buyer_id, amount_paid, balance_remaining) VALUES (?, ?, ?)',
         [id, amount, 0]
    );

    res.status(201).json({ message: 'Payment recorded successfully' });
});

const router = Router();
router.post('/', authenticate, authorize(['agent', 'owner']), validate(createBuyerSchema), createBuyer);
router.get('/', authenticate, getBuyers);
router.get('/:id/balance', authenticate, getBuyerBalance);
router.post('/:id/payment', authenticate, authorize(['agent', 'owner']), validate(recordBuyerPaymentSchema), recordBuyerPayment);

export default router;
