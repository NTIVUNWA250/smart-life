import { describe, expect, it } from 'vitest';
import {
  computeDailyBudget,
  monthDayCounts,
  splitDailyLimits,
  isWeekend,
} from '../finance.daily.js';

describe('monthDayCounts', () => {
  it('counts weekdays and weekend days for June 2026 (30 days, 8 weekend days)', () => {
    const c = monthDayCounts(new Date('2026-06-15T00:00:00Z'));
    expect(c.days).toBe(30);
    expect(c.weekends).toBe(8); // Sat/Sun in June 2026
    expect(c.weekdays).toBe(22);
  });
});

describe('splitDailyLimits', () => {
  it('gives weekends ~30% more than weekdays', () => {
    const { weekdayLimitRwf, weekendLimitRwf } = splitDailyLimits(100_000, 22, 8, 30);
    expect(weekendLimitRwf).toBeGreaterThan(weekdayLimitRwf);
    expect(weekendLimitRwf / weekdayLimitRwf).toBeCloseTo(1.3, 1);
  });

  it('never lets the realised monthly total exceed the budget (floored)', () => {
    const total = 100_000;
    const wd = 22;
    const we = 8;
    const { weekdayLimitRwf, weekendLimitRwf } = splitDailyLimits(total, wd, we, 30);
    expect(wd * weekdayLimitRwf + we * weekendLimitRwf).toBeLessThanOrEqual(total);
  });

  it('returns zero when there is nothing to distribute', () => {
    expect(splitDailyLimits(0, 22, 8, 30)).toEqual({ weekdayLimitRwf: 0, weekendLimitRwf: 0 });
  });
});

describe('isWeekend', () => {
  it('flags Saturday and Sunday', () => {
    expect(isWeekend(new Date('2026-06-27T10:00:00Z'))).toBe(true); // Sat
    expect(isWeekend(new Date('2026-06-28T10:00:00Z'))).toBe(true); // Sun
    expect(isWeekend(new Date('2026-06-26T10:00:00Z'))).toBe(false); // Fri
  });
});

describe('computeDailyBudget', () => {
  it('sets aside the heavy lump and distributes the rest with weekend flex', () => {
    // expected daily total 60k + unexpected 40k = 100k distributable
    const b = computeDailyBudget({
      dailyExpectedTotalRwf: 60_000,
      unexpectedRwf: 40_000,
      heavyExpenseRwf: 90_000,
      heavyExpenseDay: 1,
      weekendBoostPct: 30,
      now: new Date('2026-06-26T10:00:00Z'), // Friday → weekday limit applies
    });
    expect(b.distributableRwf).toBe(100_000);
    expect(b.heavyExpenseRwf).toBe(90_000);
    expect(b.todayIsWeekend).toBe(false);
    expect(b.todayLimitRwf).toBe(b.weekdayLimitRwf);
    expect(b.weekendLimitRwf).toBeGreaterThan(b.weekdayLimitRwf);
    // realised total stays within the distributable budget
    expect(b.weekdays * b.weekdayLimitRwf + b.weekends * b.weekendLimitRwf).toBeLessThanOrEqual(100_000);
  });

  it('uses the weekend limit on a Saturday', () => {
    const b = computeDailyBudget({
      dailyExpectedTotalRwf: 60_000,
      unexpectedRwf: 40_000,
      heavyExpenseRwf: 0,
      heavyExpenseDay: 1,
      now: new Date('2026-06-27T10:00:00Z'), // Saturday
    });
    expect(b.todayIsWeekend).toBe(true);
    expect(b.todayLimitRwf).toBe(b.weekendLimitRwf);
  });
});
