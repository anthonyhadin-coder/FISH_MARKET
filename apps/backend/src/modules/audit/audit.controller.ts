import { Request, Response } from 'express';
import { catchAsync } from '../../middleware/errors';
import { query } from '@fishmarket/database';

export const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const action = req.query.action as string | undefined;
    const severity = req.query.severity as string | undefined;
    const entity_type = req.query.entity_type as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (action) { conditions.push('action = ?'); params.push(action); }
    if (severity) { conditions.push('severity = ?'); params.push(severity); }
    if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countResult] = await Promise.all([
        query(
            `SELECT id, user_id, action, entity_type, entity_id, ip_address, severity, created_at
             FROM audit_logs ${where}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        ),
        query(`SELECT COUNT(*) as total FROM audit_logs ${where}`, params),
    ]);

    const total = (countResult as Array<{ total: number }>)[0]?.total ?? 0;

    res.json({
        data: rows,
        pagination: { page, limit, total, hasMore: offset + limit < total },
    });
});

export const getAuditLogById = catchAsync(async (req: Request, res: Response) => {
    const [rows] = await query(
        'SELECT * FROM audit_logs WHERE id = ?',
        [req.params.id]
    ) as unknown as [unknown[]];

    if (!rows) {
        return res.status(404).json({ message: 'Audit log not found' });
    }

    res.json({ data: rows });
});
