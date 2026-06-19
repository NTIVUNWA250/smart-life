import type { SpendingLimit } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { currentMonthPeriod, monthsUntil } from '../../lib/period.js';
import { blockAllPayments, providers, unblockAllPayments } from '../../providers/index.js';
import { logger } from '../../lib/logger.js';
import { audit } from '../../lib/audit.js';

/**
 * Auto-calculated spending limit (FR3) for the current month:
 *
 *   limit = income(this month) − requiredSavings(this month)
 *
 * where requiredSavings sums, over each active goal, the amount that must be set
 * aside this month to hit the goal by its deadline:
 *   ceil((targetRwf − savedRwf) / monthsUntil(deadline))
 *
 * When spend reaches the limit, all payment channels are blocked (FR4).
 */
async function computeLimitRwf(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  const income = await prisma.transaction.aggregate({
    _sum: { amountRwf: true },
    where: { userId, type: 'income', occurredAt: { gte: periodStart, lt: periodEnd } },
  });

  const goals = await prisma.goal.findMany({ where: { userId, status: 'active' } });
  const requiredSavings = goals.reduce((sum, g) => {
    const remaining = Math.max(0, g.targetRwf - g.savedRwf);
    return sum + Math.ceil(remaining / monthsUntil(g.deadline));
  }, 0);

  const incomeTotal = income._sum.amountRwf ?? 0;
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
  const limitRwf = await computeLimitRwf(userId, start, end);
  const spentRwf = await computeSpentRwf(userId, start, end);

  const existing = await prisma.spendingLimit.findFirst({
    where: { userId, periodStart: start },
  });

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
        data: { limitRwf, spentRwf, periodEnd: end, isBlocked: shouldBlock },
      })
    : await prisma.spendingLimit.create({
        data: { userId, periodStart: start, periodEnd: end, limitRwf, spentRwf, isBlocked: shouldBlock },
      });

  await enforce(userId, shouldBlock);
  return limit;
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
