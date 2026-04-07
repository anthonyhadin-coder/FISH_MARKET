import { Response, Router } from 'express';
import { z } from 'zod';
import pool from '../../core/db';
import { authenticate, authorize, AuthRequest } from '../../core/auth';
import { catchAsync } from '../../core/errors';
import { validate } from '../../core/validation';

const recordSaleSchema = z.object({
    body: z.object({
        boatId: z.union([z.string(), z.number()]),
        buyerName: z.string().optional(),
        fishName: z.string().min(1),
        weight: z.union([z.string(), z.number()]),
        rate: z.union([z.string(), z.number()]).refine(v => Number(v) <= 99999, { message: "Rate cannot exceed ₹99,999" }),
        amountPaid: z.union([z.string(), z.number()]).optional(),
        cashReceived: z.boolean().optional(),
    })
});

const updateSaleSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        buyerName: z.string().optional(),
        fishName: z.string().optional(),
        weight: z.union([z.string(), z.number()]).optional(),
        rate: z.union([z.string(), z.number()]).optional(),
        amountPaid: z.union([z.string(), z.number()]).optional(),
    })
});
const round = (val: number) => Math.round(val * 100) / 100;

export const recordSale = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boatId, buyerName, fishName, weight, rate, amountPaid, cashReceived } = req.body;
    const agentId = req.user?.userId;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const totalAmount = round(parseFloat(weight.toString()) * parseFloat(rate.toString()));
    
    let actualPaid = 0;
    if (amountPaid !== undefined) {
        actualPaid = round(parseFloat(amountPaid.toString()));
    } else {
        actualPaid = (cashReceived === false) ? 0 : totalAmount;
    }

    const balance = round(totalAmount - actualPaid);
    const isFullyPaidCash = actualPaid >= totalAmount;

    let buyerId = null;
    if (buyerName) {
        const [buyers]: any[] = await pool.query('SELECT id FROM buyers WHERE name = ?', [buyerName]);
        if (buyers.length > 0) {
            buyerId = buyers[0].id;
        } else {
            const [newBuyer]: any = await pool.query('INSERT INTO buyers (name) VALUES (?)', [buyerName]);
            buyerId = newBuyer.insertId;
        }
    }

    // Transaction-safe UPSERT replacement logic
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Lock existing record if it exists to prevent race conditions (FOR UPDATE)
        const [existingSales]: any = await conn.query(
            'SELECT id, weight, total, amount_paid, balance FROM sales WHERE boat_id = ? AND agent_id = ? AND fish_name = ? AND rate = ? AND (buyer_name = ? OR (buyer_name IS NULL AND ? IS NULL)) AND date = CURDATE() FOR UPDATE',
            [boatId, agentId, fishName, rate, buyerName || null, buyerName || null]
        );

        if (existingSales.length > 0) {
            const existing = existingSales[0];
            const saleId = existing.id;
            const newWeight = round(parseFloat(existing.weight) + parseFloat(weight.toString()));
            const newTotal = round(parseFloat(existing.total) + totalAmount);
            const newAmountPaid = round(parseFloat(existing.amount_paid) + actualPaid);
            const newBalance = round(newTotal - newAmountPaid);

            await conn.query(
                'UPDATE sales SET weight = ?, total = ?, amount_paid = ?, balance = ? WHERE id = ?',
                [newWeight, newTotal, newAmountPaid, newBalance, saleId]
            );

            if (buyerId && actualPaid > 0) {
                const [existingTx]: any = await conn.query('SELECT id FROM buyer_transactions WHERE sale_id = ? AND buyer_id = ?', [saleId, buyerId]);
                if (existingTx.length > 0) {
                    await conn.query(
                        'UPDATE buyer_transactions SET amount_paid = amount_paid + ?, balance_remaining = ? WHERE id = ?',
                        [actualPaid, newBalance, existingTx[0].id]
                    );
                } else {
                    await conn.query(
                        'INSERT INTO buyer_transactions (buyer_id, sale_id, amount_paid, balance_remaining) VALUES (?, ?, ?, ?)',
                        [buyerId, saleId, actualPaid, newBalance]
                    );
                }
            }

            await conn.commit();
            return res.status(200).json({
                id: saleId,
                total: newTotal,
                amountPaid: newAmountPaid,
                balance: newBalance,
                cashReceived: newAmountPaid >= newTotal
            });
        }

        // New Sale
        const [result]: any = await conn.query(
            'INSERT INTO sales (boat_id, agent_id, buyer_id, fish_name, weight, rate, total, buyer_name, amount_paid, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [boatId, agentId, buyerId, fishName, weight, rate, totalAmount, buyerName || null, actualPaid, balance]
        );

        const saleId = result.insertId;

        if (buyerId && actualPaid > 0) {
            await conn.query(
                'INSERT INTO buyer_transactions (buyer_id, sale_id, amount_paid, balance_remaining) VALUES (?, ?, ?, ?)',
                [buyerId, saleId, actualPaid, balance]
            );
        }

        await conn.commit();
        res.status(201).json({
            id: saleId,
            total: totalAmount,
            amountPaid: actualPaid,
            balance: balance,
            cashReceived: isFullyPaidCash
        });
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
});

export const getSalesHistory = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;

    const { date, boatId } = req.query;

    let queryStr = 'SELECT s.*, b.name as boat_name FROM sales s LEFT JOIN boats b ON s.boat_id = b.id WHERE 1=1';
    const queryParams: any[] = [];

    if (role === 'agent' && agentId) {
        queryStr += ' AND s.agent_id = ?';
        queryParams.push(agentId);
    } else if (role === 'owner' && agentId) {
        queryStr += ' AND b.owner_id = ?';
        queryParams.push(agentId);
    }

    if (date) {
        queryStr += ' AND s.date = ?';
        queryParams.push(date);
    }
    if (boatId) {
        queryStr += ' AND s.boat_id = ?';
        queryParams.push(boatId);
    }

    queryStr += ' ORDER BY s.date DESC, s.time DESC';

    const [sales]: any = await pool.query(queryStr, queryParams);
    res.json(sales);
});

export const deleteSale = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { id } = req.params;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows]: any = await conn.query('SELECT s.*, b.owner_id FROM sales s JOIN boats b ON s.boat_id = b.id WHERE s.id = ?', [id]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Sale not found' });
        }
        
        const sale = rows[0];
        const isOwnerOfBoat = sale.owner_id === agentId;
        const isCreatorOfSale = sale.agent_id === agentId;

        if (role !== 'admin' && !isCreatorOfSale && !isOwnerOfBoat) {
            await conn.rollback();
            return res.status(403).json({ message: 'Forbidden' });
        }

        await conn.query('DELETE FROM buyer_transactions WHERE sale_id = ?', [id]);
        await conn.query('DELETE FROM sales WHERE id = ?', [id]);
        
        await conn.commit();
        res.json({ message: 'Sale deleted', id });
    } catch (error: any) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
});

export const updateSale = catchAsync(async (req: AuthRequest, res: Response) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const agentId = req.user?.userId;
        const role = req.user?.role;
        const { id } = req.params;
        const { buyerName, fishName, weight, rate, amountPaid } = req.body;

        if (!agentId) {
            await conn.rollback();
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const [rows]: any = await conn.query('SELECT s.*, b.owner_id FROM sales s JOIN boats b ON s.boat_id = b.id WHERE s.id = ?', [id]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Sale not found' });
        }
        const existing = rows[0];
        const isOwnerOfBoat = existing.owner_id === agentId;
        const isCreatorOfSale = existing.agent_id === agentId;

        if (role !== 'admin' && !isCreatorOfSale && !isOwnerOfBoat) {
            await conn.rollback();
            return res.status(403).json({ message: 'Forbidden' });
        }

        const finalFishName = fishName !== undefined ? fishName : existing.fish_name;
        const finalWeight = weight !== undefined ? round(parseFloat(weight.toString())) : parseFloat(existing.weight);
        const finalRate = rate !== undefined ? round(parseFloat(rate.toString())) : parseFloat(existing.rate);
        const finalBuyerName = buyerName !== undefined ? buyerName : existing.buyer_name;

        const totalAmount = round(finalWeight * finalRate);
        
        let finalBuyerId = existing.buyer_id;
        if (buyerName !== undefined && buyerName !== existing.buyer_name) {
            if (buyerName) {
                const [buyers]: any = await conn.query('SELECT id FROM buyers WHERE name = ?', [buyerName]);
                if (buyers.length > 0) {
                    finalBuyerId = buyers[0].id;
                } else {
                    const [newBuyer]: any = await conn.query('INSERT INTO buyers (name) VALUES (?)', [buyerName]);
                    finalBuyerId = newBuyer.insertId;
                }
            } else {
                finalBuyerId = null;
            }
        }

        const finalAmountPaid = amountPaid !== undefined ? round(parseFloat(amountPaid.toString())) : parseFloat(existing.amount_paid);
        const newBalance = round(totalAmount - finalAmountPaid);

        await conn.query(
            'UPDATE sales SET fish_name = ?, weight = ?, rate = ?, total = ?, buyer_id = ?, buyer_name = ?, amount_paid = ?, balance = ? WHERE id = ?',
            [finalFishName, finalWeight, finalRate, totalAmount, finalBuyerId, finalBuyerName || null, finalAmountPaid, newBalance, id]
        );

        if (finalBuyerId) {
            await conn.query(
                'UPDATE buyer_transactions SET buyer_id = ?, balance_remaining = ? WHERE sale_id = ?',
                [finalBuyerId, newBalance, id]
            );
        } else {
            await conn.query('DELETE FROM buyer_transactions WHERE sale_id = ?', [id]);
        }

        await conn.commit();
        res.json({ message: 'Sale updated', id });
    } catch (error: any) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
});

const router = Router();
router.post('/', authenticate, authorize(['agent', 'owner']), validate(recordSaleSchema), recordSale);
router.get('/history', authenticate, getSalesHistory);
router.patch('/:id', authenticate, authorize(['agent', 'admin']), validate(updateSaleSchema), updateSale);
router.delete('/:id', authenticate, authorize(['agent', 'admin']), deleteSale);

export default router;
