import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        try {
            const serviceAccount = JSON.parse(
                Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
            );
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.info('Firebase Admin initialized via Base64 Service Account');
        } catch (error) {
            logger.error('Failed to initialize Firebase Admin with Base64:', error);
        }
    } else {
        logger.warn('Firebase Admin is not initialized. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 env var.');
    }
}

export const firebaseAdminAuth = admin.apps.length > 0 ? admin.auth() : null;
