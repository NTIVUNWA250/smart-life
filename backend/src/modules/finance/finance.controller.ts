import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { isSameUtcMonth } from '../../lib/period.js';
import * as finance from './finance.service.js';

export const financeRouter = Router();
financeRouter.use(requireAuth);

export const financeSchema = z.object({
  incomeRwf: z.number().int().nonnegative(),
  incomeFrequency: z.enum(['daily', 'monthly', 'yearly']),
  expensesRwf: z.number().int().nonnegative(),
  expenseFrequency: z.enum(['daily', 'monthly', 'yearly']),
  savingsRatePct: z.number().int().min(0).max(100).optional(),
});

// Current profile, the derived monthly plan, and whether an edit is allowed now.
financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await finance.getProfile(req.user!.id);
    if (!profile) {
      res.json({ profile: null, derived: null, canEditNow: true });
      return;
    }
    res.json({
      profile,
      derived: finance.derive(profile),
      canEditNow: !isSameUtcMonth(profile.lastEditedAt),
    });
  }),
);

financeRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const input = financeSchema.parse(req.body);
    const existing = await finance.getProfile(req.user!.id);
    const profile = existing
      ? await finance.updateProfile(req.user!.id, input)
      : await finance.createProfile(req.user!.id, input);
    res.json({ profile, derived: finance.derive(profile) });
  }),
);
