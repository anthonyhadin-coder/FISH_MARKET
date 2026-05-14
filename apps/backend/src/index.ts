import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pool from './config/db';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errors';
import { initSentry } from './config/sentry';
import { validateEnv } from './config/validateEnv';
import redis from './config/redis';
import { requestTracing } from './middleware/tracing';
import { httpLogger } from './middleware/pinoHttp';
import { requestTiming } from './middleware/timing';
import { checkHealth } from './controllers/health';
import { csrfProtection } from './middleware/csrf';
import { globalRateLimit, authRateLimit } from './middleware/rateLimiter';

// Validate environment early, right after loading .env
validateEnv();

// Initialize Sentry before other middlewares
initSentry();

const app = express();
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-csrf-token'],
    credentials: true
}));
app.use(cookieParser());

// Global Redis-backed Rate Limiter
app.use('/api/', globalRateLimit);

// Strict Auth Rate Limiter
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/google', authRateLimit);
app.use('/api/auth/refresh', authRateLimit);

// CSRF Protection for all mutations
app.use('/api/', csrfProtection);

app.use(express.json({ limit: '1mb' }));

// Observability Middlewares
app.use(requestTracing);
app.use(httpLogger);
app.use(requestTiming);

const PORT = process.env.PORT || 5000;

app.get('/health', checkHealth);


import authRoutes from './modules/auth/auth';
import saleRoutes from './modules/sales';
import buyerRoutes from './modules/buyers';
import boatRoutes from './modules/boats';
import expenseRoutes from './modules/expenses';
import boatPaymentRoutes from './modules/payments';
import reportRoutes from './modules/reports';
import adminRoutes from './modules/admin';
import voiceRoutes from './modules/voice';
import salariesRoutes from './modules/salaries';
import slipsRoutes from './modules/slips';
import betaRoutes from './modules/beta/feedback';
import notificationsRoutes from './modules/notifications/notifications';
import analyticsRoutes from './modules/analytics';

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
app.use('/api/analytics', analyticsRoutes);

// Global Error Handler
app.use(errorHandler);

const isTestEnv = process.env.NODE_ENV === 'test'; if (!isTestEnv) {
    app.listen(Number(PORT), '0.0.0.0', () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

export { app };
