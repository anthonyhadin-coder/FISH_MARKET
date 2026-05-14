import { Response } from 'express';
import pool from '../../../config/db';
import { AuthRequest } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errors';

export const getTrendData = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const { boatId, days = 7 } = req.query;

    if (!agentId) return res.status(401).json({ message: 'Unauthorized' });

    let boatFilter = '';
    const params: any[] = [agentId, Number(days)];
    if (boatId) {
        boatFilter = ' AND boat_id = ?';
        params.push(boatId);
    }

    // Fetch daily sales and expenses for the trend line
    // We use a LEFT JOIN on a date sequence if possible, or just group the records we have.
    // For simplicity, we'll group existing records.
    const [trendRows]: any = await pool.query(
        `SELECT 
            date, 
            COALESCE(SUM(total), 0) as sales,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE agent_id = ? AND date = s.date ${boatId ? 'AND boat_id = ?' : ''}) as expenses
         FROM sales s
         WHERE agent_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)${boatFilter}
         GROUP BY date
         ORDER BY date ASC`,
        boatId ? [agentId, boatId, agentId, Number(days), boatId] : [agentId, agentId, Number(days)]
    );

    res.json(trendRows);
});
