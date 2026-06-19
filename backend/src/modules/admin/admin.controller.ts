import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import { audit, auditToCsv } from '../../lib/audit.js';

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
    await audit('admin.user.updated', req.user!.id, `target=${user.id} ${JSON.stringify(input)}`);
    res.json({ user: updated });
  }),
);

// Audit log report (NFR4). Filterable by action / user / date range, with an
// optional CSV export (?format=csv) for offline reporting.
const auditQuerySchema = z.object({
  action: z.string().min(1).max(64).optional(),
  userId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  format: z.enum(['json', 'csv']).default('json'),
});

adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const q = auditQuerySchema.parse(req.query);
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
    };
    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.format === 'csv' ? 1000 : q.limit,
    });

    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-report.csv"');
      res.send(auditToCsv(items));
      return;
    }
    res.json({ items });
  }),
);

// Aggregated audit summary (counts per action) for the admin dashboard.
adminRouter.get(
  '/audit/summary',
  asyncHandler(async (_req, res) => {
    const grouped = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });
    res.json({ items: grouped.map((g) => ({ action: g.action, count: g._count.action })) });
  }),
);
