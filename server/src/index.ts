import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pool from './config/db';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errors';
import { initSentry } from './config/sentry';

dotenv.config();

// Initialize Sentry before other middlewares
initSentry();

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(cookieParser());

// Global rate limit (100 req / 15 min)
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', globalLimiter);

// Auth-specific strict rate limit (5 attempts / 15 min)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_LIMIT_MAX || '5'),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failures toward the limit
    handler: (_req, res) => {
        res.status(429).json({
            message: 'Too many login attempts. Please try again after 15 minutes.',
            retryAfter: 900,
        });
    },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use(express.json());

// Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 5000;

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', database: 'connected', version: '1.2.0' });
    } catch (_err) {
        res.status(503).json({ status: 'ERROR', database: 'disconnected' });
    }
});

import authRoutes from './modules/auth/auth';
import saleRoutes from './modules/agent/sales';
import buyerRoutes from './modules/agent/buyers';
import boatRoutes from './modules/owner/boats';
import expenseRoutes from './modules/owner/expenses';
import boatPaymentRoutes from './modules/owner/payments';
import reportRoutes from './modules/owner/reports';
import adminRoutes from './modules/owner/admin';
import voiceRoutes from './modules/agent/voice';
import salariesRoutes from './modules/owner/salaries';
import slipsRoutes from './modules/owner/slips';
import betaRoutes from './modules/beta/feedback';
import notificationsRoutes from './modules/notifications/notifications';

app.use('/api/auth', authRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/boat-payments', boatPaymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/salaries', salariesRoutes);
app.use('/api/slips', slipsRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/notifications', notificationsRoutes);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test' || (process.env.NODE_ENV as string) === 'e2e') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export { app };
