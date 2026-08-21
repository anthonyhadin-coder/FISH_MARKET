import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

export async function sendEmail(options: EmailOptions): Promise<void> {
    if (!process.env.SMTP_PASSWORD) {
        logger.warn({ message: 'EmailService: SMTP_PASSWORD not set — email not sent', to: options.to });
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Deep Ocean Fish Market" <${process.env.SMTP_USER}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        logger.info({ message: 'EmailService: email sent', to: options.to, subject: options.subject });
    } catch (err: unknown) {
        logger.error({ message: 'EmailService: failed to send email', error: err, to: options.to });
        throw err;
    }
}

export function buildPasswordResetEmail(resetUrl: string): string {
    return `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#0c4a6e">Password Reset Request</h2>
            <p>Click the button below to reset your password. This link expires in 15 minutes.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#0284c7;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Reset Password
            </a>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    `;
}
