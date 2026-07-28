import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/http-error.js';
import { checkPayment, recomputeCurrentLimit } from '../limits/limits.service.js';

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  amountRwf: z.number().int().positive(),
  category: z.string().min(1).max(40).optional(),
  note: z.string().max(280).optional(),
  occurredAt: z.coerce.date().optional(),
});

const listQuery = z.object({
  type: z.enum(['income', 'expense']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const items = await prisma.transaction.findMany({
      where: { userId: req.user!.id, ...(q.type ? { type: q.type } : {}) },
      orderBy: { occurredAt: 'desc' },
      take: q.limit ?? 100,
    });
    res.json({ items });
  }),
);

transactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const occurredAt = input.occurredAt ?? new Date();

    // FR3/FR4: limits are server-authoritative, so an expense is checked here and
    // not only in the client. Checked against the day it happened, so backdating
    // is measured against that day's budget rather than today's.
    if (input.type === 'expense') {
      // This call records the expense, so it is the one allowed to spend an override.
      const check = await checkPayment(req.user!.id, input.amountRwf, occurredAt, true);
      if (!check.allowed) {
        throw conflict(check.reason ?? 'This expense would exceed your spending limit.');
      }
    }

    const txn = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        type: input.type,
        amountRwf: input.amountRwf,
        category: input.category ?? 'general',
        note: input.note,
        occurredAt,
      },
    });
    // A new income/expense changes the user's limit and may trigger blocking.
    const limit = await recomputeCurrentLimit(req.user!.id);
    res.status(201).json({ transaction: txn, limit });
  }),
);

transactionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw notFound('Transaction not found');
    await prisma.transaction.delete({ where: { id: existing.id } });
    await recomputeCurrentLimit(req.user!.id);
    res.status(204).end();
  }),
);
