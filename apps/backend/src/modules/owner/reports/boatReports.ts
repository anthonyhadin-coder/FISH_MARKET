import { Response } from 'express';
import { z } from 'zod';
import pool from '../../../config/db';
import { AuthRequest } from '../../../middleware/auth';
import { catchAsync } from '../../../middleware/errors';
import { createNotification } from '../../notifications/notifications';
import { sendPushToUser, pushTemplates } from '../../../services/push.service';

export const getBoatPaymentHistorySchema = z.object({
    query: z.object({
        boatId: z.string(),
        date: z.string(),
    })
});

export const sendToOwnerSchema = z.object({
    body: z.object({
        boat_id    : z.number().positive(),
        report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    })
});

export const rejectSchema = z.object({
    body: z.object({
        reason: z.string().min(3, 'Rejection reason required'),
    })
});

export const getBoatPaymentHistory = catchAsync(async (req: AuthRequest, res: Response) => {
    const agentId = req.user?.userId;
    const { boatId, date } = req.query;

    if (!agentId) return res.status(401).json({ message: 'Unauthorized' });

    const [rows]: any = await pool.query(
        `SELECT amount, date, payment_method as method 
         FROM boat_payments 
         WHERE agent_id = ? AND boat_id = ? AND date = ?
         ORDER BY id DESC`,
        [agentId, boatId, date]
    );

    res.json(rows);
});

export const getOwnerBoatWeekly = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boat_id, week_start, week_end } = req.query;
    const owner_id = req.user?.userId;

    // 1. Verify boat belongs to owner
    const [boat]: any = await pool.query(
        `SELECT id, name FROM boats WHERE id = ? AND owner_id = ?`, 
        [boat_id, owner_id]
    );

    if (!boat.length) return res.status(403).json({ message: 'Not your boat' });

    // 2. Get daily breakdown
    // Switched catches to sales to match the schema
    const [catches]: any = await pool.query(`
        SELECT
            c.date AS report_date,
            c.fish_name,
            c.weight,
            c.rate,
            ROUND(c.weight * c.rate, 2) AS total,
            u.name AS agent_name
        FROM sales c
        JOIN users u ON u.id = c.agent_id
        WHERE c.boat_id = ?
          AND c.date BETWEEN ? AND ?
        ORDER BY report_date ASC, c.created_at ASC
    `, [boat_id, week_start, week_end]);

    // 3. Get commission rule
    const [boatRow]: any = await pool.query(
        'SELECT agent_id FROM boats WHERE id = ?', [boat_id]
    );
    const agentIdForRule = boatRow?.[0]?.agent_id;
    let rule: any = [];
    if (agentIdForRule) {
        const [ruleRows]: any = await pool.query(`
            SELECT commission_rate, bonus_target, bonus_amount
            FROM commission_rules
            WHERE agent_id = ?
            ORDER BY effective_from DESC LIMIT 1
        `, [agentIdForRule]);
        rule = ruleRows;
    }

    // 4. Calculate financials
    const grossSales = catches.reduce((sum: number, c: any) => sum + parseFloat(c.total), 0);
    const commissionRate = rule[0]?.commission_rate ?? 3;
    const agentCommission = Math.round(grossSales * commissionRate / 100 * 100) / 100;
    const targetMet = grossSales >= (rule[0]?.bonus_target ?? 0);
    const bonusEarned = targetMet ? (rule[0]?.bonus_amount ?? 0) : 0;
    const netPayableOwner = Math.round((grossSales - agentCommission - bonusEarned) * 100) / 100;

    // 5. Group by date
    const dailyBreakdown = catches.reduce((acc: any, row: any) => {
        const d = row.report_date; // might be string or Date dependent on parser
        const dStr = typeof d === 'string' ? d.substring(0, 10) : d.toISOString().substring(0, 10);
        if (!acc[dStr]) acc[dStr] = { date: dStr, agent_name: row.agent_name, entries: [], daily_total: 0 };
        acc[dStr].entries.push(row);
        acc[dStr].daily_total += parseFloat(row.total);
        return acc;
    }, {});

    res.json({
        boat_name: boat[0].name,
        week_start,
        week_end,
        daily_breakdown: Object.values(dailyBreakdown),
        owner_summary: {
            total_weight: catches.reduce((s: number, c: any) => s + parseFloat(c.weight), 0),
            gross_sales: grossSales,
            agent_commission: agentCommission,
            bonus_earned: bonusEarned,
            net_payable: netPayableOwner,
            target_met: targetMet
        }
    });
});

export const getAgentBoatWeekly = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boat_id, week_start, week_end } = req.query;
    const agent_id = req.user?.userId;

    // 1. Get agent's catches for this boat
    const [catches]: any = await pool.query(`
        SELECT
            c.date AS report_date,
            b.name AS boat_name,
            u.name AS owner_name,
            c.fish_name,
            c.weight,
            c.rate,
            ROUND(c.weight * c.rate, 2) AS total
        FROM sales c
        JOIN boats b ON b.id = c.boat_id
        JOIN users u ON u.id = b.owner_id
        WHERE c.agent_id = ?
          AND c.boat_id = ?
          AND c.date BETWEEN ? AND ?
        ORDER BY report_date ASC, c.created_at ASC
    `, [agent_id, boat_id, week_start, week_end]);

    // 2. Get commission rule
    const [rule]: any = await pool.query(`
        SELECT commission_rate, bonus_target, bonus_amount
        FROM commission_rules
        WHERE agent_id = ?
        ORDER BY effective_from DESC LIMIT 1
    `, [agent_id]);

    const grossSales = catches.reduce((sum: number, c: any) => sum + parseFloat(c.total), 0);
    const commissionRate = rule[0]?.commission_rate ?? 3;
    const myCommission = Math.round(grossSales * commissionRate / 100 * 100) / 100;
    const targetMet = grossSales >= (rule[0]?.bonus_target ?? 0);
    const bonusEarned = targetMet ? (rule[0]?.bonus_amount ?? 0) : 0;
    const totalEarnings = myCommission + bonusEarned;

    // 3. Group by date logic to flatten like Owner report or keep raw
    // To maintain symmetry between both dashboards, we'll keep raw or group
    // The user's query example just returns raw array for agent. We'll group it identical to owner.
    const dailyBreakdown = catches.reduce((acc: any, row: any) => {
        const d = row.report_date;
        const dStr = typeof d === 'string' ? d.substring(0, 10) : d.toISOString().substring(0, 10);
        if (!acc[dStr]) acc[dStr] = { date: dStr, entries: [], daily_total: 0 };
        acc[dStr].entries.push(row);
        acc[dStr].daily_total += parseFloat(row.total);
        return acc;
    }, {});

    if (!catches || catches.length === 0) {
      return res.status(200).json({ boat_name: null, owner_name: null, week_start, week_end, daily_breakdown: [], agent_summary: { total_entries: 0, gross_sales: 0, net_payable: 0 } });
    }

    res.json({
        boat_name: catches[0]?.boat_name,
        owner_name: catches[0]?.owner_name,
        week_start,
        week_end,
        daily_breakdown: Object.values(dailyBreakdown),
        agent_summary: {
            total_entries: catches.length,
            total_weight: catches.reduce((s: number, c: any) => s + parseFloat(c.weight), 0),
            gross_sales: grossSales,
            commission_rate: commissionRate,
            my_commission: myCommission,
            bonus_earned: bonusEarned,
            total_earnings: totalEarnings,
            target_met: targetMet
        }
    });
});

export const sendToOwner = catchAsync(async (req: AuthRequest, res: Response) => {
    const { boat_id, report_date } = req.body;
    const agent_id = req.user!.userId;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Verify boat exists + get owner
        const [boats]: any[] = await conn.query(`
            SELECT b.id, b.name AS boat_name, b.owner_id,
                   u.name AS owner_name
            FROM   boats b
            JOIN   users u ON u.id = b.owner_id
            WHERE  b.id = ?
        `, [boat_id]);

        if (!boats.length) {
            await conn.rollback();
            return res.status(404).json({ message: 'Boat not found' });
        }

        const { owner_id, boat_name, owner_name } = boats[0];

        // 2. Verify agent has sales entries for this boat on this date
        const [catchCheck]: any[] = await conn.query(`
            SELECT COUNT(*) AS total
            FROM   sales
            WHERE  boat_id  = ?
              AND  agent_id = ?
              AND  date     = ?
        `, [boat_id, agent_id, report_date]);

        if (catchCheck[0].total === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'No sales entries found for this boat on this date' });
        }

        // 3. Calculate totals (DECIMAL precision)
        const [totals]: any[] = await conn.query(`
            SELECT ROUND(SUM(weight), 2)        AS total_weight,
                   ROUND(SUM(weight * rate), 2) AS total_amount
            FROM  sales
            WHERE boat_id  = ?
              AND agent_id = ?
              AND date     = ?
        `, [boat_id, agent_id, report_date]);

        // 4. Upsert report — handles re-send safely
        const [reportResult]: any[] = await conn.query(`
            INSERT INTO boat_reports
                (boat_id, agent_id, owner_id, report_date,
                 total_weight, total_amount, status, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
            ON DUPLICATE KEY UPDATE
                total_weight  = VALUES(total_weight),
                total_amount  = VALUES(total_amount),
                status        = 'pending',
                sent_at       = NOW(),
                reviewed_at   = NULL,
                reject_reason = NULL
        `, [boat_id, agent_id, owner_id, report_date,
            totals[0].total_weight, totals[0].total_amount]);

        // Resolve report_id for both INSERT and UPDATE paths
        let report_id = reportResult.insertId;
        if (!report_id || report_id === 0) {
            const [existing]: any[] = await conn.query(
                'SELECT id FROM boat_reports WHERE boat_id = ? AND report_date = ?',
                [boat_id, report_date]
            );
            report_id = existing[0].id;
        }

        // 5. Snapshot catches → report items (delete old ones first)
        await conn.query('DELETE FROM boat_report_items WHERE report_id = ?', [report_id]);
        await conn.query(`
            INSERT INTO boat_report_items (report_id, fish_name, weight, rate)
            SELECT ?, fish_name, weight, rate
            FROM   sales
            WHERE  boat_id  = ?
              AND  agent_id = ?
              AND  date     = ?
        `, [report_id, boat_id, agent_id, report_date]);

        await conn.commit();

        res.status(201).json({
            success     : true,
            message     : 'Report sent to owner',
            report_id,
            boat_name,
            owner_name,
            total_amount: totals[0].total_amount,
        });

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

export const getOwnerInbox = catchAsync(async (req: AuthRequest, res: Response) => {
    const owner_id = req.user!.userId;
    const status   = (req.query.status as string) || 'pending';

    const [reports]: any[] = await pool.query(`
        SELECT r.id, r.report_date, r.total_weight, r.total_amount,
               r.status, r.sent_at, r.reviewed_at, r.reject_reason,
               b.name AS boat_name,
               u.name AS agent_name
        FROM   boat_reports r
        JOIN   boats b ON b.id = r.boat_id
        JOIN   users u ON u.id = r.agent_id
        WHERE  r.owner_id = ?
          AND  r.status   = ?
        ORDER  BY r.sent_at DESC
    `, [owner_id, status]);

    res.json({ reports });
});

export const getReportDetail = catchAsync(async (req: AuthRequest, res: Response) => {
    const user_id = req.user!.userId;

    const [reports]: any[] = await pool.query(`
        SELECT r.*,
               b.name AS boat_name,
               u.name AS agent_name,
               o.name AS owner_name
        FROM   boat_reports r
        JOIN   boats b ON b.id = r.boat_id
        JOIN   users u ON u.id = r.agent_id
        JOIN   users o ON o.id = r.owner_id
        WHERE  r.id = ?
          AND  (r.owner_id = ? OR r.agent_id = ?)
    `, [req.params.id, user_id, user_id]);

    if (!reports.length) {
        return res.status(404).json({ message: 'Report not found' });
    }

    const [items]: any[] = await pool.query(`
        SELECT fish_name, weight, rate, total
        FROM   boat_report_items
        WHERE  report_id = ?
        ORDER  BY fish_name ASC
    `, [req.params.id]);

    res.json({ ...reports[0], items });
});

export const approveReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const owner_id = req.user!.userId;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [rows]: any[] = await conn.query(`
            SELECT id, agent_id FROM boat_reports
            WHERE  id       = ?
              AND  owner_id = ?
              AND  status   = 'pending'
        `, [req.params.id, owner_id]);

        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ message: 'Report not found or already reviewed' });
        }

        await conn.query(`
            UPDATE boat_reports
            SET status = 'approved', reviewed_at = NOW()
            WHERE id = ?
        `, [req.params.id]);

        // Fetch boat and agent details for notification
        const [details]: any[] = await conn.query(`
            SELECT b.name as boat_name, u.id as agent_id, u.language
            FROM boat_reports r
            JOIN boats b ON b.id = r.boat_id
            JOIN users u ON u.id = r.agent_id
            WHERE r.id = ?
        `, [req.params.id]);

        await conn.commit();

        if (details.length) {
            const { boat_name, agent_id, language } = details[0];
            const templ = pushTemplates.report_approved(boat_name, language);
            
            // Create in-app notification
            await createNotification(
                agent_id,
                templ.title,
                templ.body,
                'success',
                'report_approved',
                `/agent/reports/${req.params.id}`
            );

            // Send Native Push
            await sendPushToUser(agent_id, {
                title: templ.title,
                body: templ.body,
                type: 'report_approved',
                url: `/agent/reports/${req.params.id}`
            });
        }

        res.json({ success: true, message: 'Report approved' });

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

export const rejectReport = catchAsync(async (req: AuthRequest, res: Response) => {
    const owner_id = req.user!.userId;
    const { reason } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [rows]: any[] = await conn.query(`
            SELECT id, agent_id FROM boat_reports
            WHERE  id       = ?
              AND  owner_id = ?
              AND  status   = 'pending'
        `, [req.params.id, owner_id]);

        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ message: 'Report not found or already reviewed' });
        }

        await conn.query(`
            UPDATE boat_reports
            SET status = 'rejected', reject_reason = ?, reviewed_at = NOW()
            WHERE id = ?
        `, [reason, req.params.id]);

        // Fetch boat and agent details for notification
        const [details]: any[] = await conn.query(`
            SELECT b.name as boat_name, u.id as agent_id, u.language
            FROM boat_reports r
            JOIN boats b ON b.id = r.boat_id
            JOIN users u ON u.id = r.agent_id
            WHERE r.id = ?
        `, [req.params.id]);

        await conn.commit();

        if (details.length) {
            const { boat_name, agent_id, language } = details[0];
            const templ = pushTemplates.report_rejected(boat_name, reason, language);
            
            // Create in-app notification
            await createNotification(
                agent_id,
                templ.title,
                templ.body,
                'error',
                'report_rejected',
                `/agent/reports/${req.params.id}`
            );

            // Send Native Push
            await sendPushToUser(agent_id, {
                title: templ.title,
                body: templ.body,
                type: 'report_rejected',
                url: `/agent/reports/${req.params.id}`
            });
        }

        res.json({ success: true, message: 'Report rejected' });

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});
