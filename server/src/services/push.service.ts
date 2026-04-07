import webpush from 'web-push';
import pool from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('VAPID keys not found in environment. Push notifications will be disabled.');
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    type?: string;
    data?: Record<string, any>;
}

/**
 * Send push to ALL active devices of a user.
 */
export async function sendPushToUser(
    userId: number,
    payload: PushPayload
): Promise<void> {
    try {
        // 1. Get all active subscriptions for user
        const [subscriptions]: any = await pool.query(`
            SELECT id, endpoint, p256dh, auth
            FROM push_subscriptions
            WHERE user_id = ? AND is_active = true
        `, [userId]);

        if (!subscriptions || subscriptions.length === 0) {
            console.log(`No active push subscriptions for user ${userId}`);
            return;
        }

        // 2. Build notification payload
        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon ?? '/icons/icon-192x192.png',
            badge: payload.badge ?? '/icons/badge-72x72.png',
            url: payload.url ?? '/',
            type: payload.type ?? 'general',
            data: payload.data ?? {},
            timestamp: Date.now()
        });

        // 3. Send to each device in parallel
        const results = await Promise.allSettled(
            subscriptions.map(async (sub: any) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        },
                        notificationPayload
                    );
                    return { id: sub.id, success: true };
                } catch (err: any) {
                    // 410 Gone = subscription expired or 404 Not Found
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`Subscription ${sub.id} expired. Deactivating...`);
                        await pool.query(
                            'UPDATE push_subscriptions SET is_active = false WHERE id = ?',
                            [sub.id]
                        );
                    }
                    throw err;
                }
            })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        console.log(`Push delivery for user ${userId}: ${succeeded}/${subscriptions.length} successful.`);
    } catch (err) {
        console.error(`Failed to send push to user ${userId}:`, err);
    }
}

/**
 * Notification Templates (Tamil + English)
 */
export const pushTemplates = {
    report_ready: (boatName: string, lang = 'en') => ({
        en: { title: 'New Report Ready 🐟', body: `${boatName} catch report needs review` },
        ta: { title: 'புதிய அறிக்கை தயார் 🐟', body: `${boatName} மீன்பிடி அறிக்கை மதிப்பாய்வு தேவை` }
    }[lang === 'tamil' ? 'ta' : 'en']),

    report_approved: (boatName: string, lang = 'en') => ({
        en: { title: 'Report Approved ✅', body: `Your ${boatName} report was approved!` },
        ta: { title: 'அறிக்கை அங்கீகரிக்கப்பட்டது ✅', body: `உங்கள் ${boatName} அறிக்கை அங்கீகரிக்கப்பட்டது!` }
    }[lang === 'tamil' ? 'ta' : 'en']),

    report_rejected: (boatName: string, reason: string, lang = 'en') => ({
        en: { title: 'Report Rejected ❌', body: `${boatName}: ${reason}` },
        ta: { title: 'அறிக்கை நிராகரிக்கப்பட்டது ❌', body: `${boatName}: ${reason}` }
    }[lang === 'tamil' ? 'ta' : 'en']),

    sync_complete: (count: number, lang = 'en') => ({
        en: { title: 'Sync Complete ✅', body: `${count} catches synced successfully` },
        ta: { title: 'ஒத்திசைவு முடிந்தது ✅', body: `${count} மீன்பிடிகள் வெற்றிகரமாக ஒத்திசைக்கப்பட்டன` }
    }[lang === 'tamil' ? 'ta' : 'en'])
};
