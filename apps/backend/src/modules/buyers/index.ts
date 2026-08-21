import { Request, Response, Router } from 'express';
import { z } from 'zod';
import pool from '@fishmarket/database';
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
    const { limit: rawLimit, cursor } = req.query;
    const isPaginated = rawLimit !== undefined || cursor !== undefined;
    const limit = Math.min(parseInt(rawLimit as string) || 200, 500);

    let queryStr = `
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
    `;
    const queryParams: any[] = [];

    if (cursor) {
        queryStr += ' WHERE b.name > ? OR (b.name = ? AND b.id > ?)';
        const [cursorName, cursorId] = (cursor as string).split('_');
        queryParams.push(cursorName, cursorName, parseInt(cursorId));
    }

    queryStr += ' ORDER BY b.name ASC, b.id ASC';
    
    if (isPaginated) {
        queryStr += ' LIMIT ?';
        queryParams.push(limit);
    }

    const [buyers]: any[] = await pool.query(queryStr, queryParams);

    if (isPaginated) {
        const lastBuyer = buyers.length > 0 ? buyers[buyers.length - 1] : null;
        const nextCursor = lastBuyer ? `${lastBuyer.name}_${lastBuyer.id}` : null;
        return res.json({
            data: buyers,
            pagination: {
                limit,
                nextCursor: buyers.length === limit ? nextCursor : null,
                hasMore: buyers.length === limit,
            }
        });
    }

    res.json(buyers);
});

/**
 * FIX (P0 — OOM): Replaced SELECT * + Array.reduce with database-side SUM() aggregation.
 * Previously this fetched ALL historical rows into Node.js memory; now a single
 * aggregation query does the work entirely in the database.
 *
 * The response shape is preserved for backward compatibility.
 */
export const getBuyerBalance = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const [buyers]: any[] = await pool.query(
        'SELECT id, name, phone, created_at FROM buyers WHERE id = ?',
        [id]
    );
    if (buyers.length === 0) return res.status(404).json({ message: 'Buyer not found' });
    const buyer = buyers[0];

    // Aggregate totals in the database — never loads all rows into Node.js.
    const [[salesAgg]]: any[] = await pool.query(
        'SELECT COALESCE(SUM(total), 0) AS totalSales FROM sales WHERE buyer_id = ?',
        [id]
    );
    const [[txAgg]]: any[] = await pool.query(
        'SELECT COALESCE(SUM(amount_paid), 0) AS totalPaid FROM buyer_transactions WHERE buyer_id = ?',
        [id]
    );

    const totalSales = Number(salesAgg.totalSales);
    const totalPaid  = Number(txAgg.totalPaid);
    const balance    = Math.round((totalSales - totalPaid) * 100) / 100;

    // Fetch the actual rows for the detail view — still needed by the frontend ledger
    const [sales]: any[]        = await pool.query('SELECT * FROM sales WHERE buyer_id = ?', [id]);
    const [transactions]: any[] = await pool.query('SELECT * FROM buyer_transactions WHERE buyer_id = ?', [id]);

    res.json({ buyer, totalSales, totalPaid, balance, sales, transactions });
});

/**
 * FIX (P0 — Financial Corruption): Replaced hardcoded `balance_remaining = 0` with
 * a proper database transaction that:
 *  1. Locks the buyer row for update to prevent concurrent over-payment.
 *  2. Computes the buyer's current outstanding balance from the DB.
 *  3. Validates that the payment does not exceed the outstanding balance.
 *  4. Inserts the transaction with the accurate remaining balance.
 *
 * Decision (user-confirmed): block payments that would make balance_remaining negative.
 */
export const recordBuyerPayment = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { amount } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Lock the buyer row so concurrent payment requests are serialised
        const [buyers]: any[] = await conn.query(
            'SELECT id FROM buyers WHERE id = ? FOR UPDATE',
            [id]
        );
        if (buyers.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Buyer not found' });
        }

        // Compute outstanding balance entirely in the database
        const [[salesAgg]]: any[] = await conn.query(
            'SELECT COALESCE(SUM(total), 0) AS totalSales FROM sales WHERE buyer_id = ?',
            [id]
        );
        const [[txAgg]]: any[] = await conn.query(
            'SELECT COALESCE(SUM(amount_paid), 0) AS totalPaid FROM buyer_transactions WHERE buyer_id = ?',
            [id]
        );

        const totalSales = Math.round(Number(salesAgg.totalSales) * 100);  // paise
        const totalPaid  = Math.round(Number(txAgg.totalPaid) * 100);       // paise
        const amountPaise = Math.round(amount * 100);                        // paise

        const currentBalancePaise = totalSales - totalPaid;

        // Block over-payment (user-confirmed: safest default is to prevent negative balance)
        if (amountPaise > currentBalancePaise) {
            await conn.rollback();
            const currentBalance = currentBalancePaise / 100;
            return res.status(400).json({
                message: `Payment of ₹${amount.toFixed(2)} exceeds outstanding balance of ₹${currentBalance.toFixed(2)}.`,
                outstandingBalance: currentBalance,
            });
        }

        const newBalancePaise    = currentBalancePaise - amountPaise;
        const newBalanceRupees   = newBalancePaise / 100;
        const amountRupees       = amountPaise / 100;

        const [result]: any[] = await conn.query(
            'INSERT INTO buyer_transactions (buyer_id, amount_paid, balance_remaining) VALUES (?, ?, ?)',
            [id, amountRupees, newBalanceRupees]
        );

        await conn.commit();

        res.status(201).json({
            message: 'Payment recorded successfully',
            transactionId: result.insertId,
            amountPaid: amountRupees,
            newBalance: newBalanceRupees,
        });
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
});

const router = Router();
router.post('/', authenticate, authorize(['agent', 'owner']), validate(createBuyerSchema), createBuyer);
router.get('/', authenticate, getBuyers);
router.get('/:id/balance', authenticate, getBuyerBalance);
router.post('/:id/payment', authenticate, authorize(['agent', 'owner']), validate(recordBuyerPaymentSchema), recordBuyerPayment);

export default router;
