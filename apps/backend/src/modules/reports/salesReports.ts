import { Response } from 'express';
import { z } from 'zod';
import pool from '../../config/db';
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

    const [salesRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE ${filterString}`,
        params
    );
    const totalSales = Number(salesRes[0].totalSales);

    const [expensesRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE ${filterString}`,
        params
    );
    const totalExpenses = Number(expensesRes[0].totalExpenses);

    const [paymentsRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE ${filterString}`,
        params
    );
    const boatPayments = Number(paymentsRes[0].totalBoatPayments);

    const cashWithAgent = totalSales - boatPayments; // As per spec: "Agent Cash = Sales – Boat Payments"
    const boatProfit = totalSales - totalExpenses; // "Profit = Sales – Expenses"

    const [expenseBreakdown]: any[] = await pool.query(
        `SELECT expense_type as type, SUM(amount) as total, GROUP_CONCAT(note SEPARATOR ', ') as notes 
         FROM expenses 
         WHERE ${filterString}
         GROUP BY expense_type`,
        params
    );

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

    const filterString = filter.filterString;
    const params = filter.params;

    // Fetch aggregation for the last 7 days
    const [salesRes]: any = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE ${filterString}`,
        params
    );
    const [expensesRes]: any = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE ${filterString}`,
        params
    );
    const [paymentsRes]: any = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE ${filterString}`,
        params
    );

    const [expenseBreakdown]: any = await pool.query(
        `SELECT expense_type as type, SUM(amount) as total 
         FROM expenses 
         WHERE ${filterString}
         GROUP BY expense_type`,
        params
    );

    res.json({
        totalSales: Number(salesRes[0].totalSales),
        totalExpenses: Number(expensesRes[0].totalExpenses),
        boatPayments: Number(paymentsRes[0].totalBoatPayments),
        expenseBreakdown
    });
});
