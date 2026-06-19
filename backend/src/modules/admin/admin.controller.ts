import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isMinor: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: users });
  }),
);

const updateSchema = z.object({
  role: z.enum(['student', 'approver', 'admin']).optional(),
  isMinor: z.boolean().optional(),
});

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('User not found');
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: input,
      select: { id: true, name: true, email: true, role: true, isMinor: true },
    });
    res.json({ user: updated });
  }),
);

adminRouter.get(
  '/audit',
  asyncHandler(async (_req, res) => {
    const items = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ items });
  }),
);
