import { Response } from 'express';
import pool from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../middleware/errors';
import { buildAgentOrOwnerFilter } from './queryBuilders';

export const getTrendData = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const { boatId, days = 7 } = req.query;

    if (!agentId) return res.status(401).json({ message: 'Unauthorized' });

    const filter = buildAgentOrOwnerFilter({
        role: req.user?.role as any || 'agent',
        userId: agentId,
        boatId: boatId as string | undefined,
        daysRange: Number(days)
    });

    const subqueryFilter = buildAgentOrOwnerFilter({
        role: req.user?.role as any || 'agent',
        userId: agentId,
        boatId: boatId as string | undefined,
        skipDate: true
    });

    const [trendRows]: any = await pool.query(
        `SELECT 
            s.date, 
            COALESCE(SUM(s.total), 0) as sales,
            COALESCE(e.expenses, 0) as expenses
         FROM sales s
         LEFT JOIN (
            SELECT date, SUM(amount) as expenses
            FROM expenses
            WHERE ${subqueryFilter.filterString}
            GROUP BY date
         ) e ON s.date = e.date
         WHERE ${filter.filterString}
         GROUP BY s.date, e.expenses
         ORDER BY s.date ASC`,
        [...subqueryFilter.params, ...filter.params]
    );

    res.json(trendRows);
});
