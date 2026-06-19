import { describe, expect, it } from 'vitest';
import { currentMonthPeriod, isNewUtcDay, monthsUntil, startOfUtcDay } from '../period.js';

describe('period', () => {
  it('computes the current calendar-month bounds in UTC', () => {
    const now = new Date(Date.UTC(2026, 5, 18)); // 18 Jun 2026
    const { start, end } = currentMonthPeriod(now);
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('returns whole months until a deadline, at least 1', () => {
    const now = new Date(Date.UTC(2026, 5, 18));
    expect(monthsUntil(new Date(Date.UTC(2026, 8, 1)), now)).toBe(3);
    expect(monthsUntil(new Date(Date.UTC(2026, 5, 25)), now)).toBe(1); // same month -> 1
    expect(monthsUntil(new Date(Date.UTC(2026, 0, 1)), now)).toBe(1); // past -> floored to 1
  });

  it('truncates a timestamp to the start of its UTC day', () => {
    const d = new Date('2026-06-18T15:41:09.000Z');
    expect(startOfUtcDay(d).toISOString()).toBe('2026-06-18T00:00:00.000Z');
  });

  it('detects a daily rollover only across UTC day boundaries', () => {
    const prev = new Date('2026-06-18T23:59:00.000Z');
    expect(isNewUtcDay(prev, new Date('2026-06-19T00:01:00.000Z'))).toBe(true);
    expect(isNewUtcDay(prev, new Date('2026-06-18T23:59:30.000Z'))).toBe(false);
    expect(isNewUtcDay(prev, new Date('2026-06-18T08:00:00.000Z'))).toBe(false); // earlier same day
  });
});
