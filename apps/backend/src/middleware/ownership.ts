import { Response, NextFunction } from 'express';
import pool from '@fishmarket/database';
import { AuthRequest } from './auth';

/**
 * Validates ownership of a boat.
 * Can be used as middleware for routes like DELETE /boats/:id
 */
export const checkBoatOwnership = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const boatId = req.params.id || req.params.boatId || req.body.boatId || req.query.boatId;
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!boatId || role === 'admin') return next();

    try {
        const [rows]: any = await pool.query('SELECT owner_id FROM boats WHERE id = ?', [boatId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Boat not found' });
        }
        
        if (role === 'owner' && rows[0].owner_id !== userId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this boat' });
        }
        
        // Pass the boat data to avoid re-fetching
        (req as any).boat = rows[0];
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Validates ownership of a sale record.
 * A sale can be modified/deleted by:
 * 1. An Admin
 * 2. The Agent who created it
 * 3. The Owner of the boat associated with the sale
 */
export const checkSaleOwnership = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const saleId = req.params.id || req.params.saleId;
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!saleId || role === 'admin') return next();

    try {
        const [rows]: any = await pool.query(
            'SELECT s.*, b.owner_id FROM sales s JOIN boats b ON s.boat_id = b.id WHERE s.id = ?',
            [saleId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Sale not found' });
        }

        const sale = rows[0];
        const isOwnerOfBoat = sale.owner_id === userId;
        const isCreatorOfSale = sale.agent_id === userId;

        if (!isCreatorOfSale && !isOwnerOfBoat) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission for this sale' });
        }

        // Pass the sale data to avoid re-fetching
        (req as any).sale = sale;
        next();
    } catch (error) {
        next(error);
    }
};
