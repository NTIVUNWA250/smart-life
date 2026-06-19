/** Current calendar-month period [start, end) in UTC, used for spending limits. */
export function currentMonthPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Whole months remaining until a deadline, at least 1. */
export function monthsUntil(deadline: Date, now = new Date()): number {
  const months =
    (deadline.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (deadline.getUTCMonth() - now.getUTCMonth());
  return Math.max(1, months);
}
