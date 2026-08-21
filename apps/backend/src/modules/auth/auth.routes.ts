import { Router } from 'express';
import { validate } from '../../middleware/validation';
import { authenticate } from '../../middleware/auth';
import {
    register,
    login,
    googleAuth,
    refresh,
    logout,
    me,
    changePassword,
    forgotPassword,
    verifyOtp,
    resetPassword,
    sendLoginOtp,
    verifyLoginOtp,
    completePhoneRegistration
} from './auth';

import { z } from 'zod';

const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional().default('AGENT'),
        password: z.string().min(8),
    })
});

const loginSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        password: z.string().min(8),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional(),
    })
});

const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
    })
});

const googleSchema = z.object({
    body: z.object({
        credential: z.string().min(1).optional(),
        code: z.string().optional(),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']).optional(),
    })
});

const firebaseLoginSchema = z.object({
    body: z.object({
        idToken: z.string().min(1),
    })
});

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', validate(googleSchema), googleAuth);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, validate(changePasswordSchema), changePassword);

// Forgot Password Flow
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// Firebase Phone Login Flow (deprecated, replaced by Twilio)
// router.post('/phone/firebase-login', validate(firebaseLoginSchema), verifyFirebasePhoneLogin);

// Twilio Phone Login Flow
const sendOtpSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
    })
});

const verifyOtpSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        otp: z.string().length(6),
    })
});

router.post('/phone/send-otp', validate(sendOtpSchema), sendLoginOtp);
router.post('/phone/verify-otp', validate(verifyOtpSchema), verifyLoginOtp);

const completeRegistrationSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\+?[\s\d\-()]{10,20}$/, 'Invalid phone number format'),
        name: z.string().min(2).optional().default('User'),
        role: z.enum(['OWNER', 'AGENT', 'BUYER']),
    })
});
router.post('/phone/complete-registration', validate(completeRegistrationSchema), completePhoneRegistration);

export default router;
