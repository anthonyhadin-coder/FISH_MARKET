/**
 * otp.service.ts
 * Handles OTP generation, SMS dispatch (Twilio), and storage.
 * Extracted from auth.ts (Phase 11). All business logic preserved exactly.
 */
import crypto from 'crypto';
import { logger } from '../../utils/logger';

/** Generate a 6-digit numeric OTP string. */
export function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/** SHA-256 hash an OTP before storing — prevents exposure if Redis/DB is compromised. */
export function hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Send an OTP SMS via Twilio.
 * Returns true on success, false on failure (caller decides how to handle).
 * Never throws — logs errors internally.
 */
export async function sendSms(phone: string, message: string): Promise<boolean> {
    const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioToken && twilioPhone) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const twilioClient = require('twilio')(twilioSid, twilioToken);
            await twilioClient.messages.create({ body: message, from: twilioPhone, to: phone });
            logger.info(`[SMS] Dispatched to ${phone}`);
            return true;
        } catch (error) {
            logger.error(error, `[SMS] Failed to send to ${phone}`);
            return false;
        }
    }

    // Development mock — log OTP to console (never expose in production)
    logger.warn(`[SMS MOCK] OTP for ${phone}: ${message.match(/\d{6}/)?.[0] ?? '(hidden)'}`);
    return true; // mock always succeeds
}
