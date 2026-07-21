import { describe, expect, it } from 'vitest';
import { addUtcMonths, isSameUtcMonth } from '../period.js';

// Covers the deadline/goal helpers not exercised by period.test.ts.
describe('period (goal helpers)', () => {
  it('adds calendar months in UTC', () => {
    const now = new Date(Date.UTC(2026, 5, 18)); // 18 Jun 2026
    expect(addUtcMonths(3, now).toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('rolls over the year boundary', () => {
    const now = new Date(Date.UTC(2026, 10, 15)); // 15 Nov 2026
    expect(addUtcMonths(3, now).toISOString()).toBe('2027-02-15T00:00:00.000Z');
  });

  it('detects same / different UTC calendar month', () => {
    const a = new Date(Date.UTC(2026, 6, 1));
    expect(isSameUtcMonth(a, new Date(Date.UTC(2026, 6, 31)))).toBe(true);
    expect(isSameUtcMonth(a, new Date(Date.UTC(2026, 7, 1)))).toBe(false);
    expect(isSameUtcMonth(a, new Date(Date.UTC(2025, 6, 1)))).toBe(false); // same month, diff year
  });
});
