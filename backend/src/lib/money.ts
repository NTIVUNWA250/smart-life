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
