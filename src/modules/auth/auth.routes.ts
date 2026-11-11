import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

// Brute-force protection: 10 failed attempts per IP + e-mail per 15 minutes.
// Keying on the e-mail as well avoids locking out everyone behind a shared
// proxy IP (the frontend proxies API calls) because of one bad actor.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.me);
