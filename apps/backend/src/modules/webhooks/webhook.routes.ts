import { Router } from 'express';
import { handlePaymentWebhook, handleSmsWebhook } from './webhook.controller';

const router = Router();

router.post('/payment', handlePaymentWebhook);
router.post('/sms', handleSmsWebhook);

export default router;
