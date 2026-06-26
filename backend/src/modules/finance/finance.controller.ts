import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { isSameUtcMonth } from '../../lib/period.js';
import * as finance from './finance.service.js';
import { BUDGET_MODELS, derive, deriveDaily } from './finance.budget.js';

export const financeRouter = Router();
financeRouter.use(requireAuth);

export const financeSchema = z.object({
  incomeRwf: z.number().int().nonnegative(),
  incomeFrequency: z.enum(['daily', 'monthly', 'yearly']),
  budgetModel: z.string().min(1).max(40).default('sixty_solution'),
  expectedPct: z.number().int().min(0).max(100),
  unexpectedPct: z.number().int().min(0).max(100),
  savingsPct: z.number().int().min(0).max(100),
  expenseFrequency: z.enum(['daily', 'monthly', 'yearly']).optional(),
  heavyExpenseRwf: z.number().int().nonnegative().optional(),
  heavyExpenseDay: z.number().int().min(1).max(28).optional(),
  weekendBoostPct: z.number().int().min(0).max(100).optional(),
});

// Current budget, the derived monthly figures, the selectable models, and whether
// an edit is allowed now.
financeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await finance.getProfile(req.user!.id);
    res.json({
      profile,
      derived: profile ? derive(profile) : null,
      daily: profile ? deriveDaily(profile, new Date()) : null,
      canEditNow: profile ? !isSameUtcMonth(profile.lastEditedAt) : true,
      models: BUDGET_MODELS,
    });
  }),
);

// Standalone models list (e.g. for the sign-up dropdown before a profile exists).
financeRouter.get(
  '/models',
  asyncHandler(async (_req, res) => {
    res.json({ models: BUDGET_MODELS });
  }),
);

const suggestSchema = z
  .object({
    incomeRwf: z.number().int().nonnegative(),
    incomeFrequency: z.enum(['daily', 'monthly', 'yearly']),
    expectedPct: z.number().int().min(0).max(100).optional(),
    expectedExpensesRwf: z.number().int().nonnegative().optional(),
  });

// Suggests a savings rate + split and time-to-goal from income, expenses & goals.
financeRouter.post(
  '/suggest',
  asyncHandler(async (req, res) => {
    const input = suggestSchema.parse(req.body);
    res.json({ suggestion: await finance.suggest(req.user!.id, input) });
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
    res.json({ profile, derived: derive(profile), daily: deriveDaily(profile, new Date()) });
  }),
);
