// All money in SMART LIFE is integer Rwandan Francs (RWF). No fractional francs.

export function formatRwf(amount: number): string {
  return `RWF ${Math.round(amount).toLocaleString('en-RW')}`;
}

/** Guard that a value is a non-negative whole number of francs. */
export function assertWholeRwf(amount: number, field = 'amount'): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${field} must be a non-negative whole number of RWF`);
  }
}

export type Frequency = 'daily' | 'monthly' | 'yearly';

/**
 * Normalises an amount entered at some frequency to a whole-RWF monthly figure.
 * Daily uses a 30-day month; yearly divides across 12 months.
 */
export function toMonthlyRwf(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'daily':
      return Math.round(amount * 30);
    case 'yearly':
      return Math.round(amount / 12);
    case 'monthly':
    default:
      return Math.round(amount);
  }
}
