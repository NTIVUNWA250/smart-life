import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import * as authService from './auth.service.js';
import { toPublicUser } from './auth.service.js';
import { loginSchema, refreshSchema, signupSchema } from './auth.schemas.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    await audit('auth.signup', result.user.id, `role=${result.user.role}`);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    await audit('auth.login', result.user.id);
    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refresh(refreshToken);
    res.json({ tokens });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw notFound('User not found');
    res.json({ user: toPublicUser(user) });
  }),
);
