import { describe, expect, it } from 'vitest';
import {
  BUDGET_MODELS,
  derive,
  findModel,
  progressiveSavingsBasePct,
  suggestBudget,
  validateAllocation,
} from '../finance.budget.js';

describe('budget models', () => {
  it('defaults to the 60% Solution (60/10/30)', () => {
    const m = findModel('sixty_solution');
    expect(m).toMatchObject({ expectedPct: 60, unexpectedPct: 10, savingsPct: 30, selectable: true });
  });

  it('flags models below the 30% savings floor as non-selectable', () => {
    expect(findModel('balanced_50_30_20')?.selectable).toBe(false);
    expect(findModel('rule_70_20_10')?.selectable).toBe(false);
  });

  it('every model totals 100%', () => {
    for (const m of BUDGET_MODELS) {
      expect(m.expectedPct + m.unexpectedPct + m.savingsPct).toBe(100);
    }
  });
});

describe('validateAllocation', () => {
  it('accepts a compliant split', () => {
    expect(() => validateAllocation({ expectedPct: 60, unexpectedPct: 10, savingsPct: 30 })).not.toThrow();
  });

  it('rejects splits that do not total 100%', () => {
    expect(() => validateAllocation({ expectedPct: 60, unexpectedPct: 10, savingsPct: 20 })).toThrow();
  });

  it('allows any unexpected rate while total expenses stay ≤ 70%', () => {
    expect(() => validateAllocation({ expectedPct: 40, unexpectedPct: 30, savingsPct: 30 })).not.toThrow();
  });

  it('rejects total expenses above 70%', () => {
    expect(() => validateAllocation({ expectedPct: 65, unexpectedPct: 15, savingsPct: 20 })).toThrow();
  });

  it('rejects savings below 30%', () => {
    expect(() => validateAllocation({ expectedPct: 50, unexpectedPct: 25, savingsPct: 25 })).toThrow();
  });

  it('ignores extra fields when a superset (full input) is passed', () => {
    // Regression: incomeRwf must not be treated as a percentage.
    expect(() =>
      validateAllocation({
        incomeRwf: 200_000,
        incomeFrequency: 'monthly',
        budgetModel: 'sixty_solution',
        expectedPct: 60,
        unexpectedPct: 10,
        savingsPct: 30,
      } as unknown as Parameters<typeof validateAllocation>[0]),
    ).not.toThrow();
  });
});

describe('derive', () => {
  it('computes monthly figures and the goal-funding savings bucket', () => {
    const d = derive({
      incomeRwf: 150_000,
      incomeFrequency: 'monthly',
      expectedPct: 60,
      unexpectedPct: 10,
      savingsPct: 30,
    });
    expect(d.expectedExpensesRwf).toBe(90_000);
    expect(d.unexpectedRwf).toBe(15_000);
    expect(d.savingsRwf).toBe(45_000);
    expect(d.spendingAllowanceRwf).toBe(105_000); // 70% of income
    expect(d.autoGoalTargetRwf).toBe(540_000); // 45k * 12
  });

  it('normalises a yearly income to monthly first', () => {
    const d = derive({
      incomeRwf: 1_200_000,
      incomeFrequency: 'yearly',
      expectedPct: 60,
      unexpectedPct: 10,
      savingsPct: 30,
    });
    expect(d.monthlyIncomeRwf).toBe(100_000);
    expect(d.savingsRwf).toBe(30_000);
  });
});

describe('progressiveSavingsBasePct', () => {
  it('rises with income', () => {
    expect(progressiveSavingsBasePct(50_000)).toBe(30);
    expect(progressiveSavingsBasePct(200_000)).toBe(35);
    expect(progressiveSavingsBasePct(500_000)).toBe(40);
    expect(progressiveSavingsBasePct(1_000_000)).toBe(45);
    expect(progressiveSavingsBasePct(2_000_000)).toBe(50);
  });
});

describe('suggestBudget', () => {
  it('reserves a 10% unexpected buffer instead of zeroing it (60% expenses)', () => {
    const s = suggestBudget({
      monthlyIncomeRwf: 500_000,
      expectedPct: 60,
      goalRemainingRwf: 100_000,
      goalRequiredPerMonthRwf: 20_000, // modest
    });
    expect(s.expectedPct).toBe(60);
    expect(s.unexpectedPct).toBe(10); // buffer reserved
    expect(s.savingsPct).toBe(30); // progressive 40 ceded to the buffer
    expect(s.expectedPct + s.unexpectedPct + s.savingsPct).toBe(100);
  });

  it('shrinks the buffer when goals need the room', () => {
    const s = suggestBudget({
      monthlyIncomeRwf: 200_000,
      expectedPct: 40,
      goalRemainingRwf: 600_000,
      goalRequiredPerMonthRwf: 110_000, // 55% of income
    });
    expect(s.savingsPct).toBe(55);
    expect(s.unexpectedPct).toBe(5); // buffer shrank from 10 → 5 to fund goals
  });

  it('uses the income-progressive floor when goals are modest', () => {
    const s = suggestBudget({
      monthlyIncomeRwf: 500_000,
      expectedPct: 50,
      goalRemainingRwf: 100_000,
      goalRequiredPerMonthRwf: 20_000, // 4% of income
    });
    expect(s.savingsPct).toBe(40); // progressive floor for 500k dominates
    expect(s.expectedPct + s.unexpectedPct + s.savingsPct).toBe(100);
    expect(s.meetsGoalDeadlines).toBe(true);
    expect(s.monthsToReachGoals).toBe(1); // 100k / 200k saved per month
  });

  it('raises savings to meet demanding goals, capped by expenses', () => {
    const s = suggestBudget({
      monthlyIncomeRwf: 200_000,
      expectedPct: 40,
      goalRemainingRwf: 600_000,
      goalRequiredPerMonthRwf: 110_000, // 55% of income
    });
    expect(s.savingsPct).toBe(55); // lifted to the goal requirement
    expect(s.unexpectedPct).toBe(5); // 100 - 40 - 55
  });

  it('flags when expenses leave too little to meet goal deadlines', () => {
    const s = suggestBudget({
      monthlyIncomeRwf: 100_000,
      expectedPct: 70,
      goalRemainingRwf: 600_000,
      goalRequiredPerMonthRwf: 50_000, // 50% needed but only 30% available
    });
    expect(s.savingsPct).toBe(30); // capped: 100 - 70
    expect(s.meetsGoalDeadlines).toBe(false);
    expect(s.monthsToReachGoals).toBe(20); // 600k / 30k
  });
});
