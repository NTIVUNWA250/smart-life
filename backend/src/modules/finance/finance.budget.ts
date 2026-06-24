import { badRequest } from '../../lib/http-error.js';
import { toMonthlyRwf, type Frequency } from '../../lib/money.js';

/** Hard guardrails (SRS FR3): savings can never fall below 30% of income, and the
 *  unexpected-expense buffer can never exceed 10%. */
export const SAVINGS_FLOOR_PCT = 30;
export const MAX_UNEXPECTED_PCT = 10;

export interface BudgetModel {
  id: string;
  name: string;
  description: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
  /** False when the model's savings rate is below the 30% floor (shown, not selectable). */
  selectable: boolean;
}

/**
 * Researched budgeting / savings frameworks. Those below the 30% savings floor
 * are kept for recognition but flagged non-selectable so the app's rule holds.
 */
export const BUDGET_MODELS: BudgetModel[] = [
  {
    id: 'sixty_solution',
    name: 'The 60% Solution',
    description: '60% expenses · 10% unexpected · 30% savings',
    expectedPct: 60,
    unexpectedPct: 10,
    savingsPct: 30,
    selectable: true,
  },
  {
    id: 'accelerated_40',
    name: 'Accelerated saver',
    description: '50% expenses · 10% unexpected · 40% savings',
    expectedPct: 50,
    unexpectedPct: 10,
    savingsPct: 40,
    selectable: true,
  },
  {
    id: 'fire_50',
    name: 'FIRE half-saver',
    description: '40% expenses · 10% unexpected · 50% savings',
    expectedPct: 40,
    unexpectedPct: 10,
    savingsPct: 50,
    selectable: true,
  },
  {
    id: 'lean_fire_60',
    name: 'Lean FIRE',
    description: '30% expenses · 10% unexpected · 60% savings',
    expectedPct: 30,
    unexpectedPct: 10,
    savingsPct: 60,
    selectable: true,
  },
  {
    id: 'extreme_fire_70',
    name: 'Extreme FIRE',
    description: '20% expenses · 10% unexpected · 70% savings',
    expectedPct: 20,
    unexpectedPct: 10,
    savingsPct: 70,
    selectable: true,
  },
  // —— Well-known models below the 30% savings floor (reference only) ——
  {
    id: 'balanced_50_30_20',
    name: '50/30/20 rule',
    description: '50% needs · 30% wants · 20% savings — below the 30% savings floor',
    expectedPct: 70,
    unexpectedPct: 10,
    savingsPct: 20,
    selectable: false,
  },
  {
    id: 'rule_70_20_10',
    name: '70/20/10 rule',
    description: '70% expenses · 20% savings · 10% debt/giving — below the 30% floor',
    expectedPct: 70,
    unexpectedPct: 10,
    savingsPct: 20,
    selectable: false,
  },
  {
    id: 'pay_yourself_80_20',
    name: '80/20 — pay yourself first',
    description: '80% expenses · 20% savings — below the 30% savings floor',
    expectedPct: 70,
    unexpectedPct: 10,
    savingsPct: 20,
    selectable: false,
  },
];

export const DEFAULT_MODEL_ID = 'sixty_solution';

export function findModel(id: string): BudgetModel | undefined {
  return BUDGET_MODELS.find((m) => m.id === id);
}

export interface Allocation {
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
}

/** Enforces the budgeting guardrails; throws a 400 on any violation. */
export function validateAllocation(a: Allocation): void {
  // Only the three percentage fields are checked (callers may pass a superset).
  const pcts: ReadonlyArray<[string, number]> = [
    ['expectedPct', a.expectedPct],
    ['unexpectedPct', a.unexpectedPct],
    ['savingsPct', a.savingsPct],
  ];
  for (const [key, value] of pcts) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw badRequest(`${key} must be a whole number between 0 and 100`);
    }
  }
  if (a.expectedPct + a.unexpectedPct + a.savingsPct !== 100) {
    throw badRequest('Expected, unexpected and savings percentages must total 100%');
  }
  if (a.unexpectedPct > MAX_UNEXPECTED_PCT) {
    throw badRequest(`Unexpected expenses can be at most ${MAX_UNEXPECTED_PCT}% of income`);
  }
  if (a.savingsPct < SAVINGS_FLOOR_PCT) {
    throw badRequest(`Savings must be at least ${SAVINGS_FLOOR_PCT}% of income`);
  }
}

export interface FinanceLike {
  incomeRwf: number;
  incomeFrequency: Frequency;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
}

export interface FinanceDerived {
  monthlyIncomeRwf: number;
  expectedExpensesRwf: number;
  unexpectedRwf: number;
  savingsRwf: number;
  /** Spendable allowance = expected + unexpected (before any goal tightening). */
  spendingAllowanceRwf: number;
  /** Auto savings goal target across a 12-month horizon. */
  autoGoalTargetRwf: number;
}

/** Turns a profile's percentages + income into concrete monthly RWF figures. */
export function derive(p: FinanceLike): FinanceDerived {
  const monthlyIncomeRwf = toMonthlyRwf(p.incomeRwf, p.incomeFrequency);
  const expectedExpensesRwf = Math.round((monthlyIncomeRwf * p.expectedPct) / 100);
  const unexpectedRwf = Math.round((monthlyIncomeRwf * p.unexpectedPct) / 100);
  const savingsRwf = Math.round((monthlyIncomeRwf * p.savingsPct) / 100);
  return {
    monthlyIncomeRwf,
    expectedExpensesRwf,
    unexpectedRwf,
    savingsRwf,
    spendingAllowanceRwf: expectedExpensesRwf + unexpectedRwf,
    autoGoalTargetRwf: savingsRwf * 12,
  };
}
