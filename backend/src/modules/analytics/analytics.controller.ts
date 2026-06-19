import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { currentMonthPeriod } from '../../lib/period.js';
import { getCurrentLimit } from '../limits/limits.service.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// Dashboard summary (FR7): savings, spend vs. limit, and time usage.
analyticsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { start, end } = currentMonthPeriod();

    const [goals, income, expense, policies, limit] = await Promise.all([
      prisma.goal.findMany({ where: { userId } }),
      prisma.transaction.aggregate({
        _sum: { amountRwf: true },
        where: { userId, type: 'income', occurredAt: { gte: start, lt: end } },
      }),
      prisma.transaction.aggregate({
        _sum: { amountRwf: true },
        where: { userId, type: 'expense', occurredAt: { gte: start, lt: end } },
      }),
      prisma.screenTimePolicy.findMany({ where: { userId } }),
      getCurrentLimit(userId),
    ]);

    const savedRwf = goals.reduce((s, g) => s + g.savedRwf, 0);
    const targetRwf = goals.reduce((s, g) => s + g.targetRwf, 0);

    res.json({
      period: { start, end },
      finance: {
        incomeRwf: income._sum.amountRwf ?? 0,
        expenseRwf: expense._sum.amountRwf ?? 0,
        limitRwf: limit.limitRwf,
        spentRwf: limit.spentRwf,
        isBlocked: limit.isBlocked,
      },
      savings: {
        savedRwf,
        targetRwf,
        progressPct: targetRwf > 0 ? Math.round((savedRwf / targetRwf) * 100) : 0,
        activeGoals: goals.filter((g) => g.status === 'active').length,
        achievedGoals: goals.filter((g) => g.status === 'achieved').length,
      },
      time: {
        totalUsedMin: policies.reduce((s, p) => s + p.usedMin, 0),
        totalLimitMin: policies.reduce((s, p) => s + p.dailyLimitMin, 0),
        blocked: policies.filter((p) => p.isBlocked).map((p) => p.appOrSite),
      },
    });
  }),
);
