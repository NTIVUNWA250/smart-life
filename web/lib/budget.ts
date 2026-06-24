// Client mirror of the backend budget models (saving-app/backend/src/modules/
// finance/finance.budget.ts). The server validates authoritatively; this lets the
// sign-up dropdown render before the user is authenticated.

import type { Frequency } from './types';

export const SAVINGS_FLOOR_PCT = 30;
export const MAX_EXPENSES_PCT = 70;
export const DEFAULT_MODEL_ID = 'sixty_solution';
export const CUSTOM_MODEL_ID = 'custom';

export interface BudgetModel {
  id: string;
  name: string;
  description: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
  selectable: boolean;
}

export const BUDGET_MODELS: BudgetModel[] = [
  { id: 'sixty_solution', name: 'The 60% Solution', description: '60% expenses · 10% unexpected · 30% savings', expectedPct: 60, unexpectedPct: 10, savingsPct: 30, selectable: true },
  { id: 'accelerated_40', name: 'Accelerated saver', description: '50% expenses · 10% unexpected · 40% savings', expectedPct: 50, unexpectedPct: 10, savingsPct: 40, selectable: true },
  { id: 'fire_50', name: 'FIRE half-saver', description: '40% expenses · 10% unexpected · 50% savings', expectedPct: 40, unexpectedPct: 10, savingsPct: 50, selectable: true },
  { id: 'lean_fire_60', name: 'Lean FIRE', description: '30% expenses · 10% unexpected · 60% savings', expectedPct: 30, unexpectedPct: 10, savingsPct: 60, selectable: true },
  { id: 'extreme_fire_70', name: 'Extreme FIRE', description: '20% expenses · 10% unexpected · 70% savings', expectedPct: 20, unexpectedPct: 10, savingsPct: 70, selectable: true },
  { id: 'balanced_50_30_20', name: '50/30/20 rule', description: '50% needs · 30% wants · 20% savings — below the 30% floor', expectedPct: 70, unexpectedPct: 10, savingsPct: 20, selectable: false },
  { id: 'rule_70_20_10', name: '70/20/10 rule', description: '70% expenses · 20% savings · 10% debt/giving — below the 30% floor', expectedPct: 70, unexpectedPct: 10, savingsPct: 20, selectable: false },
  { id: 'pay_yourself_80_20', name: '80/20 — pay yourself first', description: '80% expenses · 20% savings — below the 30% floor', expectedPct: 70, unexpectedPct: 10, savingsPct: 20, selectable: false },
];

export function findModel(id: string): BudgetModel | undefined {
  return BUDGET_MODELS.find((m) => m.id === id);
}

export interface Allocation {
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
}

/** Returns a human-readable error if the split breaks the guardrails, else null. */
export function validateBudget(a: Allocation): string | null {
  if (a.expectedPct + a.unexpectedPct + a.savingsPct !== 100) {
    return 'Percentages must total 100%.';
  }
  if (a.expectedPct + a.unexpectedPct > MAX_EXPENSES_PCT) {
    return `Total expenses can be at most ${MAX_EXPENSES_PCT}%.`;
  }
  if (a.savingsPct < SAVINGS_FLOOR_PCT) {
    return `Savings must be at least ${SAVINGS_FLOOR_PCT}%.`;
  }
  return null;
}

/** Mirror of the backend progressive savings floor (rises with income). */
export function progressiveSavingsBasePct(monthlyIncomeRwf: number): number {
  if (monthlyIncomeRwf < 100_000) return 30;
  if (monthlyIncomeRwf < 300_000) return 35;
  if (monthlyIncomeRwf < 700_000) return 40;
  if (monthlyIncomeRwf < 1_500_000) return 45;
  return 50;
}

export interface BudgetSuggestion {
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
  monthlySavingsRwf: number;
  monthsToReachGoals: number;
  meetsGoalDeadlines: boolean;
  rationale: string;
}

/**
 * Client mirror of the backend suggestion, used at sign-up where there are no
 * goals yet (goalRemaining / goalRequired = 0). Post-auth the API is used instead.
 */
export function suggestBudgetClient(monthlyIncomeRwf: number, expectedPct: number): BudgetSuggestion {
  const income = Math.max(0, monthlyIncomeRwf);
  const exp = Math.min(MAX_EXPENSES_PCT, Math.max(0, Math.round(expectedPct)));
  const maxSavings = 100 - exp;
  const savingsPct = Math.min(maxSavings, Math.max(SAVINGS_FLOOR_PCT, progressiveSavingsBasePct(income)));
  const unexpectedPct = Math.max(0, 100 - exp - savingsPct);
  return {
    expectedPct: exp,
    unexpectedPct,
    savingsPct,
    monthlySavingsRwf: Math.round((income * savingsPct) / 100),
    monthsToReachGoals: 0,
    meetsGoalDeadlines: true,
    rationale: `Saving ${savingsPct}% — this rate rises as your income grows. Add goals to get a goal-based suggestion.`,
  };
}

export function toMonthly(amount: number, freq: Frequency): number {
  if (freq === 'daily') return Math.round(amount * 30);
  if (freq === 'yearly') return Math.round(amount / 12);
  return Math.round(amount);
}

/** Inverse of toMonthly: express a monthly amount in the given cadence. */
export function fromMonthly(monthlyAmount: number, freq: Frequency): number {
  if (freq === 'daily') return Math.round(monthlyAmount / 30);
  if (freq === 'yearly') return Math.round(monthlyAmount * 12);
  return Math.round(monthlyAmount);
}

export interface BudgetDerived {
  monthlyIncomeRwf: number;
  expectedExpensesRwf: number;
  unexpectedRwf: number;
  savingsRwf: number;
  spendingAllowanceRwf: number;
  autoGoalTargetRwf: number;
}

export function deriveBudget(
  incomeRwf: number,
  freq: Frequency,
  a: Allocation,
): BudgetDerived {
  const monthlyIncomeRwf = toMonthly(incomeRwf, freq);
  const expectedExpensesRwf = Math.round((monthlyIncomeRwf * a.expectedPct) / 100);
  const unexpectedRwf = Math.round((monthlyIncomeRwf * a.unexpectedPct) / 100);
  const savingsRwf = Math.round((monthlyIncomeRwf * a.savingsPct) / 100);
  return {
    monthlyIncomeRwf,
    expectedExpensesRwf,
    unexpectedRwf,
    savingsRwf,
    spendingAllowanceRwf: expectedExpensesRwf + unexpectedRwf,
    autoGoalTargetRwf: savingsRwf * 12,
  };
}
