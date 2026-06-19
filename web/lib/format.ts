// Formatting helpers. All monetary values are integer Rwandan Francs (RWF).

export function formatRwf(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `RWF ${safe.toLocaleString('en-US')}`;
}

export function formatMinutes(min: number): string {
  const total = Math.max(0, Math.round(min));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Clamp a percentage into the 0-100 range for progress bars. */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
