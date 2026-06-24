import { describe, expect, it } from 'vitest';
import {
  BUDGET_MODELS,
  derive,
  findModel,
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

  it('rejects unexpected expenses above 10%', () => {
    expect(() => validateAllocation({ expectedPct: 55, unexpectedPct: 15, savingsPct: 30 })).toThrow();
  });

  it('rejects savings below 30%', () => {
    expect(() => validateAllocation({ expectedPct: 70, unexpectedPct: 10, savingsPct: 20 })).toThrow();
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
