import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as limits from './limits.service.js';

export const limitsRouter = Router();
limitsRouter.use(requireAuth);

limitsRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    res.json({ limit: await limits.getCurrentLimit(req.user!.id) });
  }),
);

const checkSchema = z.object({ amountRwf: z.number().int().nonnegative() });

limitsRouter.post(
  '/check',
  asyncHandler(async (req, res) => {
    const { amountRwf } = checkSchema.parse(req.body);
    res.json(await limits.checkPayment(req.user!.id, amountRwf));
  }),
);

limitsRouter.post(
  '/block',
  asyncHandler(async (req, res) => {
    // Force a recompute; if over limit it blocks. Used by the mobile app on demand.
    res.json({ limit: await limits.recomputeCurrentLimit(req.user!.id) });
  }),
);

const unexpectedIncomeSchema = z.object({ amountRwf: z.number().int().nonnegative() });

// Record ad-hoc income received this month; lifts the spendable limit and savings.
limitsRouter.put(
  '/unexpected-income',
  asyncHandler(async (req, res) => {
    const { amountRwf } = unexpectedIncomeSchema.parse(req.body);
    res.json({ limit: await limits.setUnexpectedIncome(req.user!.id, amountRwf) });
  }),
);

export { limits };
