import { Response } from 'express';
import { z } from 'zod';
import pool from '../../../config/db';
import { AuthRequest } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errors';

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

    const CLAUSE_ALLOW_LIST = {
        agentFilter: 'agent_id = ?',
        ownerFilter: 'boat_id IN (SELECT id FROM boats WHERE owner_id = ?)',
        all: '1=1',
    } as const;

    let matchAgentOrOwnerObj = '';
    const matchParams: any[] = [];
    
    if (role === 'agent') {
        matchAgentOrOwnerObj = CLAUSE_ALLOW_LIST.agentFilter;
        matchParams.push(agentId);
    } else if (role === 'owner') {
        matchAgentOrOwnerObj = CLAUSE_ALLOW_LIST.ownerFilter;
        matchParams.push(agentId); // agentId here holds the owner's userId
    } else if (role === 'admin') {
        matchAgentOrOwnerObj = CLAUSE_ALLOW_LIST.all;
    } else {
        return res.status(403).json({ message: 'Invalid role' });
    }

    let dateFilter = 'date = CURRENT_DATE';
    if (date) {
        dateFilter = 'date = ?';
        matchParams.push(date);
    }

    let boatFilter = '';
    if (boatId) {
        boatFilter = ' AND boat_id = ?';
        matchParams.push(boatId);
    }

    // Fetch Total Sales
    const [salesRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE ${matchAgentOrOwnerObj} AND ${dateFilter}${boatFilter}`,
        [...matchParams]
    );
    const totalSales = Number(salesRes[0].totalSales);

    // Fetch Total Expenses
    const [expensesRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE ${matchAgentOrOwnerObj} AND ${dateFilter}${boatFilter}`,
        [...matchParams]
    );
    const totalExpenses = Number(expensesRes[0].totalExpenses);

    // Fetch Total Boat Payments
    const [paymentsRes]: any[] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE ${matchAgentOrOwnerObj} AND ${dateFilter}${boatFilter}`,
        [...matchParams]
    );
    const boatPayments = Number(paymentsRes[0].totalBoatPayments);

    const cashWithAgent = totalSales - boatPayments; // As per spec: "Agent Cash = Sales – Boat Payments"
    const boatProfit = totalSales - totalExpenses; // "Profit = Sales – Expenses"

    // Fetch Expense Breakdown
    const [expenseBreakdown]: any[] = await pool.query(
        `SELECT expense_type as type, SUM(amount) as total, GROUP_CONCAT(note SEPARATOR ', ') as notes 
         FROM expenses 
         WHERE ${matchAgentOrOwnerObj} AND ${dateFilter}${boatFilter}
         GROUP BY expense_type`,
        [...matchParams]
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

    let boatFilter = '';
    const params: any[] = [agentId];
    if (boatId) {
        boatFilter = ' AND boat_id = ?';
        params.push(boatId);
    }

    // Fetch aggregation for the last 7 days
    const [salesRes]: any = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as totalSales FROM sales WHERE agent_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)${boatFilter}`,
        [...params]
    );
    const [expensesRes]: any = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE agent_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)${boatFilter}`,
        [...params]
    );
    const [paymentsRes]: any = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as totalBoatPayments FROM boat_payments WHERE agent_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)${boatFilter}`,
        [...params]
    );

    const [expenseBreakdown]: any = await pool.query(
        `SELECT expense_type as type, SUM(amount) as total 
         FROM expenses 
         WHERE agent_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)${boatFilter}
         GROUP BY expense_type`,
        [...params]
    );

    res.json({
        totalSales: Number(salesRes[0].totalSales),
        totalExpenses: Number(expensesRes[0].totalExpenses),
        boatPayments: Number(paymentsRes[0].totalBoatPayments),
        expenseBreakdown
    });
});
