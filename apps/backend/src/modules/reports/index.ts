import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validation';

import { getDailyReport, getWeeklyReport, getDailyReportSchema, getWeeklyReportSchema } from './salesReports';
import { getTrendData } from './analyticsReports';
import { 
    getBoatPaymentHistory, getBoatPaymentHistorySchema, 
    getOwnerBoatWeekly, getAgentBoatWeekly, 
    sendToOwner, sendToOwnerSchema,
    getOwnerInbox, 
    getReportDetail, 
    approveReport, 
    rejectReport, rejectSchema 
} from './boatReports';

const router = Router();

router.get('/daily', authenticate, validate(getDailyReportSchema), getDailyReport);
router.get('/weekly', authenticate, validate(getWeeklyReportSchema), getWeeklyReport);
router.get('/trends', authenticate, getTrendData);
router.get('/boat-payments', authenticate, validate(getBoatPaymentHistorySchema), getBoatPaymentHistory);

router.get('/boat/owner-weekly', authenticate, authorize(['owner']), getOwnerBoatWeekly);
router.get('/boat/agent-weekly', authenticate, authorize(['agent']), getAgentBoatWeekly);

router.post('/send-to-owner', authenticate, authorize(['agent']), validate(sendToOwnerSchema), sendToOwner);
router.get('/owner-inbox', authenticate, authorize(['owner']), getOwnerInbox);
router.get('/detail/:id', authenticate, getReportDetail);
router.patch('/:id/approve', authenticate, authorize(['owner']), approveReport);
router.patch('/:id/reject', authenticate, authorize(['owner']), validate(rejectSchema), rejectReport);

export default router;
