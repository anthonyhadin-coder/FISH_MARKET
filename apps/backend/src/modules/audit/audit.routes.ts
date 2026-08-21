import { Router } from 'express';
import { getAuditLogs, getAuditLogById } from './audit.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate); // Require authentication for audit logs

router.get('/', getAuditLogs);
router.get('/:id', getAuditLogById);

export default router;
