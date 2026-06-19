/** Current calendar-month period [start, end) in UTC, used for spending limits. */
export function currentMonthPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Start of the UTC day containing `d`. Used to reset daily screen-time counters. */
export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** True when `now` falls on a later UTC day than `prev` (i.e. the daily window rolled over). */
export function isNewUtcDay(prev: Date, now = new Date()): boolean {
  return startOfUtcDay(now).getTime() > startOfUtcDay(prev).getTime();
}

/** Whole months remaining until a deadline, at least 1. */
export function monthsUntil(deadline: Date, now = new Date()): number {
  const months =
    (deadline.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (deadline.getUTCMonth() - now.getUTCMonth());
  return Math.max(1, months);
}
