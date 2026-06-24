import type { SpendingLimit } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { currentMonthPeriod, monthsUntil } from '../../lib/period.js';
import { blockAllPayments, providers, unblockAllPayments } from '../../providers/index.js';
import { logger } from '../../lib/logger.js';
import { audit } from '../../lib/audit.js';
import { derive } from '../finance/finance.budget.js';

/** Monthly RWF that active goals require, to hit each target by its deadline. */
async function requiredGoalSavingsRwf(userId: string): Promise<number> {
  const goals = await prisma.goal.findMany({ where: { userId, status: 'active' } });
  return goals.reduce((sum, g) => {
    const remaining = Math.max(0, g.targetRwf - g.savedRwf);
    return sum + Math.ceil(remaining / monthsUntil(g.deadline));
  }, 0);
}

/**
 * Spending limit (FR3) for the current month. When the user has a budget profile
 * it is percentage-based and goal-aware:
 *
 *   limit = monthlyIncome − max(savingsBucket, requiredGoalSavings)
 *
 * where savingsBucket = savings% × income. The limit therefore reserves at least
 * the savings allocation (≥30%), and tightens further if goals demand more — so
 * it depends on income, the budget percentages, and the goals.
 *
 * Without a profile it falls back to actual income(this month) − requiredSavings.
 * When spend reaches the limit, all payment channels are blocked (FR4).
 */
async function computeLimitRwf(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  extraIncomeRwf = 0,
): Promise<number> {
  const requiredSavings = await requiredGoalSavingsRwf(userId);
  const profile = await prisma.financeProfile.findUnique({ where: { userId } });

  if (profile) {
    // Unexpected income for the month lifts both the effective income and the
    // savings bucket (savings% of the larger income), so users save more.
    const monthlyIncomeRwf = derive(profile).monthlyIncomeRwf + extraIncomeRwf;
    const savingsBucket = Math.round((monthlyIncomeRwf * profile.savingsPct) / 100);
    const reserved = Math.max(savingsBucket, requiredSavings);
    return Math.max(0, monthlyIncomeRwf - reserved);
  }

  // Fallback: derive income from actual transactions when no budget is set.
  const income = await prisma.transaction.aggregate({
    _sum: { amountRwf: true },
    where: { userId, type: 'income', occurredAt: { gte: periodStart, lt: periodEnd } },
  });
  const incomeTotal = (income._sum.amountRwf ?? 0) + extraIncomeRwf;
  return Math.max(0, incomeTotal - requiredSavings);
}

async function computeSpentRwf(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  const spent = await prisma.transaction.aggregate({
    _sum: { amountRwf: true },
    where: { userId, type: 'expense', occurredAt: { gte: periodStart, lt: periodEnd } },
  });
  return spent._sum.amountRwf ?? 0;
}

/** Recomputes the current-period limit, persists it, and enforces blocking. */
export async function recomputeCurrentLimit(userId: string): Promise<SpendingLimit> {
  const { start, end } = currentMonthPeriod();

  const existing = await prisma.spendingLimit.findFirst({
    where: { userId, periodStart: start },
  });
  const extraIncomeRwf = existing?.unexpectedIncomeRwf ?? 0;

  const limitRwf = await computeLimitRwf(userId, start, end, extraIncomeRwf);
  const spentRwf = await computeSpentRwf(userId, start, end);

  // Don't auto-unblock if an admin/over-limit block is in force and still over limit.
  const overLimit = spentRwf >= limitRwf && limitRwf >= 0;
  const shouldBlock = overLimit;

  // Record only the false→true / true→false transitions, not every recompute.
  if ((existing?.isBlocked ?? false) !== shouldBlock) {
    await audit(
      shouldBlock ? 'limit.blocked' : 'limit.unblocked',
      userId,
      `spent=${spentRwf} limit=${limitRwf}`,
    );
  }

  const limit = existing
    ? await prisma.spendingLimit.update({
        where: { id: existing.id },
        // unexpectedIncomeRwf is intentionally preserved (set via setUnexpectedIncome).
        data: { limitRwf, spentRwf, periodEnd: end, isBlocked: shouldBlock },
      })
    : await prisma.spendingLimit.create({
        data: { userId, periodStart: start, periodEnd: end, limitRwf, spentRwf, isBlocked: shouldBlock },
      });

  await enforce(userId, shouldBlock);
  return limit;
}

/** Sets (or clears) ad-hoc income for the current month, then recomputes. */
export async function setUnexpectedIncome(userId: string, amountRwf: number): Promise<SpendingLimit> {
  const { start } = currentMonthPeriod();
  // Ensure a row exists for the period, then store the amount and recompute.
  await recomputeCurrentLimit(userId);
  await prisma.spendingLimit.updateMany({
    where: { userId, periodStart: start },
    data: { unexpectedIncomeRwf: Math.max(0, Math.round(amountRwf)) },
  });
  return recomputeCurrentLimit(userId);
}

async function enforce(userId: string, blocked: boolean): Promise<void> {
  if (blocked) {
    await blockAllPayments(userId);
    logger.info('limits.blocked', { userId });
  } else {
    await unblockAllPayments(userId);
  }
}

export async function getCurrentLimit(userId: string): Promise<SpendingLimit> {
  return recomputeCurrentLimit(userId);
}

/** FR4 check: can the user make a payment of `amountRwf` right now? */
export async function checkPayment(
  userId: string,
  amountRwf: number,
): Promise<{ allowed: boolean; reason?: string; limit: SpendingLimit }> {
  const limit = await recomputeCurrentLimit(userId);
  if (limit.isBlocked) {
    return { allowed: false, reason: 'Spending is currently blocked', limit };
  }
  if (limit.spentRwf + amountRwf > limit.limitRwf) {
    return { allowed: false, reason: 'Payment would exceed your spending limit', limit };
  }
  // Confirm with the payment providers (any channel blocked => deny).
  const channelOk = await Promise.all(
    Object.values(providers.payment).map((p) => p.authorize(userId, amountRwf)),
  );
  if (channelOk.some((ok) => !ok)) {
    return { allowed: false, reason: 'Payment channel is blocked', limit };
  }
  return { allowed: true, limit };
}

/** Manually unblock (used after an approval is granted). */
export async function unblock(userId: string): Promise<SpendingLimit> {
  await unblockAllPayments(userId);
  const { start } = currentMonthPeriod();
  const existing = await prisma.spendingLimit.findFirst({ where: { userId, periodStart: start } });
  if (existing) {
    return prisma.spendingLimit.update({ where: { id: existing.id }, data: { isBlocked: false } });
  }
  return recomputeCurrentLimit(userId);
}
