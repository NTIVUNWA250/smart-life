// Daily spending budget (FR3/FR4). The month's "distributable" money — daily
// expected spendings (food, transport…) plus the unexpected buffer — is shared
// across the days, with weekends given a boost over weekdays. Weekday limits are
// lowered to compensate so the monthly total never exceeds what was budgeted.
//
// Big monthly expenses (rent) are NOT part of this; they are paid as a lump on
// the heavy-spending day and are exempt from the daily limit.

export const DEFAULT_WEEKEND_BOOST_PCT = 30;

/** Calendar-day counts for the month containing `date` (UTC). */
export function monthDayCounts(date: Date): { days: number; weekdays: number; weekends: number } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let weekends = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Date.UTC(year, month, d)).getUTCDay();
    if (dow === 0 || dow === 6) weekends++;
  }
  return { days, weekdays: days - weekends, weekends };
}

export function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Splits a monthly distributable amount into weekday/weekend daily limits such
 * that  weekdays·x + weekends·(x·boost) = total,  with weekend = weekday·boost.
 * Both are floored so the realised total can only be ≤ `total` (never over).
 */
export function splitDailyLimits(
  totalRwf: number,
  weekdays: number,
  weekends: number,
  boostPct: number = DEFAULT_WEEKEND_BOOST_PCT,
): { weekdayLimitRwf: number; weekendLimitRwf: number } {
  const boost = 1 + Math.max(0, boostPct) / 100;
  const denom = weekdays + boost * weekends;
  if (denom <= 0 || totalRwf <= 0) return { weekdayLimitRwf: 0, weekendLimitRwf: 0 };
  const x = totalRwf / denom;
  return { weekdayLimitRwf: Math.floor(x), weekendLimitRwf: Math.floor(x * boost) };
}

export interface DailyBudget {
  /** Daily-spread money for the month: daily expected spendings + unexpected buffer. */
  distributableRwf: number;
  weekdayLimitRwf: number;
  weekendLimitRwf: number;
  weekendBoostPct: number;
  /** The limit that applies to `now`'s day. */
  todayLimitRwf: number;
  todayIsWeekend: boolean;
  /** Lump monthly expense (rent) and the day it's paid — exempt from the daily limit. */
  heavyExpenseRwf: number;
  heavyExpenseDay: number;
  daysInMonth: number;
  weekdays: number;
  weekends: number;
}

/**
 * What may be spent on `now`'s day: the day's share, plus the heavy lump on the
 * day it falls due (rent is exempt from the daily limit, so it needs headroom).
 */
export function todayAllowanceRwf(budget: DailyBudget, now: Date): number {
  const isHeavyDay = now.getUTCDate() === budget.heavyExpenseDay;
  return budget.todayLimitRwf + (isHeavyDay ? budget.heavyExpenseRwf : 0);
}

export function computeDailyBudget(params: {
  /** Expected expenses that recur daily = expected total − heavy lump. */
  dailyExpectedTotalRwf: number;
  unexpectedRwf: number;
  heavyExpenseRwf: number;
  heavyExpenseDay: number;
  weekendBoostPct?: number;
  now: Date;
}): DailyBudget {
  const { days, weekdays, weekends } = monthDayCounts(params.now);
  const distributableRwf = Math.max(0, params.dailyExpectedTotalRwf) + Math.max(0, params.unexpectedRwf);
  const boostPct = params.weekendBoostPct ?? DEFAULT_WEEKEND_BOOST_PCT;
  const { weekdayLimitRwf, weekendLimitRwf } = splitDailyLimits(distributableRwf, weekdays, weekends, boostPct);
  const todayIsWeekend = isWeekend(params.now);
  return {
    distributableRwf,
    weekdayLimitRwf,
    weekendLimitRwf,
    weekendBoostPct: boostPct,
    todayLimitRwf: todayIsWeekend ? weekendLimitRwf : weekdayLimitRwf,
    todayIsWeekend,
    heavyExpenseRwf: params.heavyExpenseRwf,
    heavyExpenseDay: params.heavyExpenseDay,
    daysInMonth: days,
    weekdays,
    weekends,
  };
}
