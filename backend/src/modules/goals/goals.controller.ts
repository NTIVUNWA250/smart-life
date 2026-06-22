import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import { recomputeCurrentLimit } from '../limits/limits.service.js';
import { requestGoalEdit } from './goals.service.js';

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().min(2).max(80),
  targetRwf: z.number().int().positive(),
  deadline: z.coerce.date(),
});

// PATCH only records progress / status. Editing a goal's *definition*
// (title/target/deadline) goes through POST /:id/edit-request → approval.
const updateSchema = z.object({
  addSavedRwf: z.number().int().positive().optional(),
  status: z.enum(['active', 'achieved', 'failed']).optional(),
});

// A requested change to a goal's definition; routed through an approver.
const editRequestSchema = z.object({
  title: z.string().min(2).max(80).optional(),
  targetRwf: z.number().int().positive().optional(),
  deadline: z.coerce.date().optional(),
  approverId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

goalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.goal.findMany({
      where: { userId: req.user!.id },
      orderBy: { deadline: 'asc' },
    });
    res.json({ items });
  }),
);

goalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const goal = await prisma.goal.create({
      data: {
        userId: req.user!.id,
        title: input.title,
        targetRwf: input.targetRwf,
        deadline: input.deadline,
      },
    });
    // A new goal raises required savings, lowering the spending limit.
    const limit = await recomputeCurrentLimit(req.user!.id);
    res.status(201).json({ goal, limit });
  }),
);

goalsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw notFound('Goal not found');

    const savedRwf = existing.savedRwf + (input.addSavedRwf ?? 0);
    const status =
      input.status ?? (savedRwf >= existing.targetRwf ? 'achieved' : existing.status);

    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: { savedRwf, status },
    });
    const limit = await recomputeCurrentLimit(req.user!.id);
    res.json({ goal, limit });
  }),
);

// Request a definition edit (title/target/deadline). Allowed once a month and
// must be approved — by a parent for minors, or a peer for adults.
goalsRouter.post(
  '/:id/edit-request',
  asyncHandler(async (req, res) => {
    const input = editRequestSchema.parse(req.body);
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!me) throw notFound('User not found');

    const approval = await requestGoalEdit(
      me,
      req.params.id,
      {
        title: input.title,
        targetRwf: input.targetRwf,
        deadline: input.deadline?.toISOString(),
      },
      { approverId: input.approverId, reason: input.reason },
    );
    res.status(201).json({ approval: { ...approval, reasonEnc: undefined, proposedEnc: undefined } });
  }),
);
