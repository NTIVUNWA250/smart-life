import type { FinanceProfile } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { toMonthlyRwf, type Frequency } from '../../lib/money.js';
import { addUtcMonths, isSameUtcMonth } from '../../lib/period.js';
import { recomputeCurrentLimit } from '../limits/limits.service.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict } from '../../lib/http-error.js';

export interface FinanceInput {
  incomeRwf: number;
  incomeFrequency: Frequency;
  expensesRwf: number;
  expenseFrequency: Frequency;
  savingsRatePct?: number;
}

const AUTO_GOAL_TITLE = 'Auto savings plan';
/** The auto goal spans a year so the monthly required-savings maths is stable. */
const AUTO_GOAL_HORIZON_MONTHS = 12;

/** Derived monthly figures for a finance profile (all whole RWF). */
export interface FinanceDerived {
  monthlyIncomeRwf: number;
  monthlyExpensesRwf: number;
  monthlySurplusRwf: number;
  monthlySavingsRwf: number;
  autoGoalTargetRwf: number;
}

export function derive(profile: {
  incomeRwf: number;
  incomeFrequency: Frequency;
  expensesRwf: number;
  expenseFrequency: Frequency;
  savingsRatePct: number;
}): FinanceDerived {
  const monthlyIncomeRwf = toMonthlyRwf(profile.incomeRwf, profile.incomeFrequency);
  const monthlyExpensesRwf = toMonthlyRwf(profile.expensesRwf, profile.expenseFrequency);
  const monthlySurplusRwf = Math.max(0, monthlyIncomeRwf - monthlyExpensesRwf);
  const monthlySavingsRwf = Math.floor((monthlySurplusRwf * profile.savingsRatePct) / 100);
  return {
    monthlyIncomeRwf,
    monthlyExpensesRwf,
    monthlySurplusRwf,
    monthlySavingsRwf,
    autoGoalTargetRwf: monthlySavingsRwf * AUTO_GOAL_HORIZON_MONTHS,
  };
}

function validate(input: FinanceInput): Required<FinanceInput> {
  const savingsRatePct = input.savingsRatePct ?? 50;
  if (savingsRatePct < 0 || savingsRatePct > 100) {
    throw badRequest('savingsRatePct must be between 0 and 100');
  }
  if (input.incomeRwf < 0 || input.expensesRwf < 0) {
    throw badRequest('Income and expenses must be non-negative');
  }
  return { ...input, savingsRatePct };
}

/** Creates or replaces the user's single auto-calculated savings goal. */
async function syncAutoGoal(userId: string, targetRwf: number): Promise<void> {
  const existing = await prisma.goal.findFirst({ where: { userId, isAuto: true } });
  const deadline = addUtcMonths(AUTO_GOAL_HORIZON_MONTHS);
  if (existing) {
    await prisma.goal.update({
      where: { id: existing.id },
      // Re-deriving the plan keeps prior progress (savedRwf) intact.
      data: { targetRwf: Math.max(targetRwf, existing.savedRwf), deadline },
    });
  } else if (targetRwf > 0) {
    await prisma.goal.create({
      data: { userId, title: AUTO_GOAL_TITLE, targetRwf, deadline, isAuto: true },
    });
  }
}

/** Sign-up step: store the profile and seed the auto goal. */
export async function createProfile(userId: string, raw: FinanceInput): Promise<FinanceProfile> {
  const input = validate(raw);
  const existing = await prisma.financeProfile.findUnique({ where: { userId } });
  if (existing) throw conflict('Finance profile already exists');

  const profile = await prisma.financeProfile.create({
    data: {
      userId,
      incomeRwf: input.incomeRwf,
      incomeFrequency: input.incomeFrequency,
      expensesRwf: input.expensesRwf,
      expenseFrequency: input.expenseFrequency,
      savingsRatePct: input.savingsRatePct,
    },
  });

  await syncAutoGoal(userId, derive(profile).autoGoalTargetRwf);
  await recomputeCurrentLimit(userId);
  await audit('finance.profile.created', userId, `savings=${input.savingsRatePct}%`);
  return profile;
}

/** Edit the profile — allowed at most once per calendar month (FR3 control). */
export async function updateProfile(userId: string, raw: FinanceInput): Promise<FinanceProfile> {
  const input = validate(raw);
  const existing = await prisma.financeProfile.findUnique({ where: { userId } });
  if (!existing) throw badRequest('No finance profile to edit — set one first');

  // The profile is seeded at creation, so block a second change in the same month.
  if (isSameUtcMonth(existing.lastEditedAt)) {
    throw conflict('Your finance profile can only be edited once a month');
  }

  const profile = await prisma.financeProfile.update({
    where: { userId },
    data: {
      incomeRwf: input.incomeRwf,
      incomeFrequency: input.incomeFrequency,
      expensesRwf: input.expensesRwf,
      expenseFrequency: input.expenseFrequency,
      savingsRatePct: input.savingsRatePct,
      lastEditedAt: new Date(),
    },
  });

  await syncAutoGoal(userId, derive(profile).autoGoalTargetRwf);
  await recomputeCurrentLimit(userId);
  await audit('finance.profile.updated', userId, `savings=${input.savingsRatePct}%`);
  return profile;
}

export async function getProfile(userId: string): Promise<FinanceProfile | null> {
  return prisma.financeProfile.findUnique({ where: { userId } });
}
