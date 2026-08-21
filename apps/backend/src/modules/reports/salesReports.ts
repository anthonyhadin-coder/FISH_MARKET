import { Response } from 'express';
import { z } from 'zod';
import pool from '@fishmarket/database';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { buildAgentOrOwnerFilter } from './queryBuilders';

export const getDailyReportSchema = z.object({
    query: z.object({
        date: z.string().optional(),
        boatId: z.string().optional(),
    })
});

export const getWeeklyReportSchema = z.object({
    query: z.object({
        boatId: z.string().optional(),
    })
});

/**
 * PHASE 9 FIX — Sequential queries parallelized with Promise.all.
 * Previously 4 independent pool.query() calls were awaited sequentially,
 * multiplying latency by 4x. They share no transaction dependency and
 * can safely execute in parallel against the read-only replica or pool.
 */
export const getDailyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const role = req.user?.role;
    const { date, boatId } = req.query;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    let filterString = '';
    let params: any[] = [];
    try {
        const filter = buildAgentOrOwnerFilter({
            role: role as any,
            userId: agentId,
            date: date as string | undefined,
            boatId: boatId as string | undefined
        });
        filterString = filter.filterString;
        params = filter.params;
    } catch (e: any) {
        return res.status(403).json({ message: e.message });
    }

    // All 4 queries are independent reads — execute in parallel to eliminate 4x serial latency
    const [
        [salesRes],
        [expensesRes],
        [paymentsRes],
        [expenseBreakdown],
    ] = await Promise.all([
        pool.query(
            `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT expense_type as type, SUM(amount) as total, GROUP_CONCAT(note SEPARATOR ', ') as notes 
             FROM expenses 
             WHERE ${filterString}
             GROUP BY expense_type`,
            params
        ) as Promise<any[]>,
    ]);

    const totalSales    = Number((salesRes as any)[0].totalSales);
    const totalExpenses = Number((expensesRes as any)[0].totalExpenses);
    const boatPayments  = Number((paymentsRes as any)[0].totalBoatPayments);

    const cashWithAgent = totalSales - boatPayments;
    const boatProfit    = totalSales - totalExpenses;

    res.json({
        date: date || new Date().toISOString().split('T')[0],
        totalSales,
        totalExpenses,
        expenseBreakdown,
        boatPayments,
        cashWithAgent,
        boatProfit
    });
});

/**
 * PHASE 9 FIX — getWeeklyReport: same parallel query optimization applied.
 */
export const getWeeklyReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const { boatId } = req.query;

    if (!agentId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const filter = buildAgentOrOwnerFilter({
        role: req.user?.role as any || 'agent',
        userId: agentId,
        boatId: boatId as string | undefined,
        daysRange: 7
    });

    const { filterString, params } = filter;

    const [
        [salesRes],
        [expensesRes],
        [paymentsRes],
        [expenseBreakdown],
    ] = await Promise.all([
        pool.query(
            `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE ${filterString}`,
            params
        ) as Promise<any[]>,
        pool.query(
            `SELECT expense_type as type, SUM(amount) as total 
             FROM expenses 
             WHERE ${filterString}
             GROUP BY expense_type`,
            params
        ) as Promise<any[]>,
    ]);

    res.json({
        totalSales:     Number((salesRes as any)[0].totalSales),
        totalExpenses:  Number((expensesRes as any)[0].totalExpenses),
        boatPayments:   Number((paymentsRes as any)[0].totalBoatPayments),
        expenseBreakdown,
    });
});
