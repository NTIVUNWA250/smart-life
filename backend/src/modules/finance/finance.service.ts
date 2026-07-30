import type { FinanceProfile } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { toMonthlyRwf, type Frequency } from '../../lib/money.js';
import { isSameUtcMonth, addUtcMonths, monthsUntil } from '../../lib/period.js';
import { recomputeCurrentLimit } from '../limits/limits.service.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict } from '../../lib/http-error.js';
import {
  derive,
  findModel,
  validateAllocation,
  suggestBudget,
  DEFAULT_MODEL_ID,
  type BudgetSuggestion,
} from './finance.budget.js';

export interface FinanceInput {
  incomeRwf: number;
  incomeFrequency: Frequency;
  budgetModel: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
  expenseFrequency?: Frequency;
  heavyExpenseRwf?: number;
  heavyExpenseDay?: number;
  weekendBoostPct?: number;
}

/** The auto goal spans a year so the monthly required-savings maths is stable. */
const AUTO_GOAL_HORIZON_MONTHS = 12;
const AUTO_GOAL_TITLE = 'Auto savings plan';

function validate(input: FinanceInput): FinanceInput {
  if (input.incomeRwf < 0) throw badRequest('Income must be non-negative');
  // A non-custom model id must be a known, selectable model.
  if (input.budgetModel !== 'custom') {
    const model = findModel(input.budgetModel);
    if (!model) throw badRequest(`Unknown budget model: ${input.budgetModel}`);
    if (!model.selectable) throw badRequest(`"${model.name}" is below the 30% savings floor`);
  }
  validateAllocation(input);

  const heavyDay = input.heavyExpenseDay ?? 1;
  if (heavyDay < 1 || heavyDay > 28) throw badRequest('Heavy-expense day must be between 1 and 28');
  const boost = input.weekendBoostPct ?? 30;
  if (boost < 0 || boost > 100) throw badRequest('Weekend boost must be between 0 and 100%');
  const heavy = input.heavyExpenseRwf ?? 0;
  if (heavy < 0) throw badRequest('Heavy monthly expense must be non-negative');
  const monthlyIncome = toMonthlyRwf(input.incomeRwf, input.incomeFrequency);
  const expectedExpenses = Math.round((monthlyIncome * input.expectedPct) / 100);
  if (heavy > expectedExpenses) {
    throw badRequest('Heavy monthly expense can’t exceed your expected expenses');
  }

  return input;
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

function toData(input: FinanceInput) {
  return {
    incomeRwf: input.incomeRwf,
    incomeFrequency: input.incomeFrequency,
    budgetModel: input.budgetModel || DEFAULT_MODEL_ID,
    expectedPct: input.expectedPct,
    unexpectedPct: input.unexpectedPct,
    savingsPct: input.savingsPct,
    expenseFrequency: input.expenseFrequency ?? 'monthly',
    heavyExpenseRwf: Math.max(0, input.heavyExpenseRwf ?? 0),
    heavyExpenseDay: input.heavyExpenseDay ?? 1,
    weekendBoostPct: input.weekendBoostPct ?? 30,
  };
}

/** Sign-up step: store the budget and seed the auto goal. */
export async function createProfile(userId: string, raw: FinanceInput): Promise<FinanceProfile> {
  const input = validate(raw);
  const existing = await prisma.financeProfile.findUnique({ where: { userId } });
  if (existing) throw conflict('Finance profile already exists');

  const profile = await prisma.financeProfile.create({ data: { userId, ...toData(input) } });
  await syncAutoGoal(userId, derive(profile).autoGoalTargetRwf);
  await recomputeCurrentLimit(userId);
  await audit('finance.profile.created', userId, `model=${input.budgetModel} savings=${input.savingsPct}%`);
  return profile;
}

/** Edit the budget - allowed at most once per calendar month (FR3 control). */
export async function updateProfile(userId: string, raw: FinanceInput): Promise<FinanceProfile> {
  const input = validate(raw);
  const existing = await prisma.financeProfile.findUnique({ where: { userId } });
  if (!existing) throw badRequest('No finance profile to edit - set one first');

  if (isSameUtcMonth(existing.lastEditedAt)) {
    throw conflict('Your budget can only be edited once a month');
  }

  const profile = await prisma.financeProfile.update({
    where: { userId },
    data: { ...toData(input), lastEditedAt: new Date() },
  });
  await syncAutoGoal(userId, derive(profile).autoGoalTargetRwf);
  await recomputeCurrentLimit(userId);
  await audit('finance.profile.updated', userId, `model=${input.budgetModel} savings=${input.savingsPct}%`);
  return profile;
}

export async function getProfile(userId: string): Promise<FinanceProfile | null> {
  return prisma.financeProfile.findUnique({ where: { userId } });
}

export interface SuggestRequest {
  incomeRwf: number;
  incomeFrequency: Frequency;
  /** Either an explicit expected-expense percentage... */
  expectedPct?: number;
  /** ...or a RWF amount, from which the percentage is auto-calculated. */
  expectedExpensesRwf?: number;
}

/**
 * Suggests a savings rate + split and the time to reach goals, based on the
 * user's active goals, the given income and their stated expected expenses.
 */
export async function suggest(userId: string, input: SuggestRequest): Promise<BudgetSuggestion> {
  const monthlyIncomeRwf = toMonthlyRwf(input.incomeRwf, input.incomeFrequency);

  let expectedPct = input.expectedPct ?? 60;
  if (input.expectedPct === undefined && input.expectedExpensesRwf !== undefined && monthlyIncomeRwf > 0) {
    expectedPct = Math.round((input.expectedExpensesRwf / monthlyIncomeRwf) * 100);
  }

  const goals = await prisma.goal.findMany({ where: { userId, status: 'active' } });
  const goalRemainingRwf = goals.reduce((s, g) => s + Math.max(0, g.targetRwf - g.savedRwf), 0);
  const goalRequiredPerMonthRwf = goals.reduce((s, g) => {
    const remaining = Math.max(0, g.targetRwf - g.savedRwf);
    return s + Math.ceil(remaining / monthsUntil(g.deadline));
  }, 0);

  return suggestBudget({ monthlyIncomeRwf, expectedPct, goalRemainingRwf, goalRequiredPerMonthRwf });
}
