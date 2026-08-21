import { Response } from 'express';
import pool from '@fishmarket/database';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { buildAgentOrOwnerFilter } from './queryBuilders';

/**
 * PHASE 6 FIX — Expense-only days disappear bug resolved.
 *
 * Original query: FROM sales LEFT JOIN expenses
 *   → Days with expenses but ZERO sales disappeared entirely from the result.
 *
 * Fix: Use the 7-day calendar table as the base (outermost FROM),
 * LEFT JOIN both sales and expenses aggregates onto it independently.
 * Every date in the window now appears in the result, regardless of
 * whether there were sales, expenses, both, or neither.
 */
export const getTrendData = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const { boatId, days = 7 } = req.query;

    if (!agentId) return res.status(401).json({ message: 'Unauthorized' });

    const daysNum = Math.min(Math.max(parseInt(days as string) || 7, 1), 90);

    // Build role-scoped filter for sales (skips date — applied per-subquery)
    const salesFilter = buildAgentOrOwnerFilter({
        role: req.user?.role as any || 'agent',
        userId: agentId,
        boatId: boatId as string | undefined,
        skipDate: true,
    });

    // Build role-scoped filter for expenses (skips date — applied per-subquery)
    const expensesFilter = buildAgentOrOwnerFilter({
        role: req.user?.role as any || 'agent',
        userId: agentId,
        boatId: boatId as string | undefined,
        skipDate: true,
    });

    const [trendRows]: any = await pool.query(
        `SELECT
            d.date,
            COALESCE(s.sales, 0)    AS sales,
            COALESCE(e.expenses, 0) AS expenses
         FROM (
             -- Calendar table: guarantees every date in the window appears in output
             SELECT CURDATE() - INTERVAL seq.n DAY AS date
             FROM (
                 SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
                 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
                 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
                 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
                 UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
             ) seq
             WHERE seq.n < ?
         ) d
         LEFT JOIN (
             SELECT DATE(date) AS date, COALESCE(SUM(total), 0) AS sales
             FROM sales
             WHERE ${salesFilter.filterString}
               AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(date)
         ) s ON s.date = d.date
         LEFT JOIN (
             SELECT DATE(date) AS date, COALESCE(SUM(amount), 0) AS expenses
             FROM expenses
             WHERE ${expensesFilter.filterString}
               AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(date)
         ) e ON e.date = d.date
         ORDER BY d.date ASC`,
        [
            daysNum,
            ...salesFilter.params, daysNum,
            ...expensesFilter.params, daysNum,
        ]
    );

    res.json(trendRows);
});
