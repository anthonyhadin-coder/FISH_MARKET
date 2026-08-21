import { Request, Response } from 'express';
import { catchAsync } from '../../middleware/errors';

export const handlePaymentWebhook = catchAsync(async (req: Request, res: Response) => {
    // Verify signature
    res.json({ received: true });
});

export const handleSmsWebhook = catchAsync(async (req: Request, res: Response) => {
    // Process SMS status updates
    res.json({ received: true });
});
