import { logger } from '../utils/logger';

interface SmsOptions {
    to: string;    // E.164 format: +91XXXXXXXXXX
    body: string;
}

/**
 * Send SMS via Twilio.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE env vars.
 * Fails gracefully when unconfigured.
 */
export async function sendSms(options: SmsOptions): Promise<void> {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
        logger.warn({ message: 'SmsService: Twilio credentials not set — SMS not sent', to: options.to });
        return;
    }

    try {
        // Lazy-load twilio to avoid startup cost when unconfigured
        const twilio = await import('twilio');
        const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        await client.messages.create({
            body: options.body,
            from: TWILIO_PHONE,
            to: options.to,
        });

        logger.info({ message: 'SmsService: SMS sent', to: options.to });
    } catch (err: unknown) {
        logger.error({ message: 'SmsService: failed to send SMS', error: err, to: options.to });
        throw err;
    }
}

export function buildOtpMessage(otp: string): string {
    return `Your Deep Ocean Fish Market OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;
}
