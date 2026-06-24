// Pure scheduling logic for the weekly timetable. Times are minutes from local
// midnight (0–1439); days are 0=Sunday … 6=Saturday. Activities do not wrap past
// midnight (endMin > startMin), so an overnight block is entered as two parts.

export const MINUTES_PER_DAY = 1440;
export const MIN_REMINDER_LEAD = 5;

/** Minimal shape the schedule helpers need (Prisma rows satisfy this). */
export interface ScheduleEntry {
  id: string;
  daysOfWeek: number[];
  startMin: number;
  endMin: number;
  isolation: boolean;
  reminderEnabled: boolean;
  reminderLeadMin: number;
}

export interface Clock {
  dow: number; // 0–6
  min: number; // 0–1439
}

/** Derives the local day-of-week + minute-of-day from a Date (UTC fields). */
export function clockFromDate(d: Date): Clock {
  return { dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function occursOn(entry: ScheduleEntry, dow: number): boolean {
  return entry.daysOfWeek.includes(dow);
}

/** True when `min` falls inside the entry's window on day `dow`. */
export function isActiveAt(entry: ScheduleEntry, { dow, min }: Clock): boolean {
  return occursOn(entry, dow) && min >= entry.startMin && min < entry.endMin;
}

export function activeEntries<T extends ScheduleEntry>(entries: T[], clock: Clock): T[] {
  return entries.filter((e) => isActiveAt(e, clock));
}

/** Whether two entries share any weekday AND overlap in time (used to block clashes). */
export function entriesOverlap(a: ScheduleEntry, b: ScheduleEntry): boolean {
  const sharesDay = a.daysOfWeek.some((d) => b.daysOfWeek.includes(d));
  if (!sharesDay) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export interface DueReminder<T> {
  entry: T;
  /** Whole minutes until the activity starts (0 … reminderLeadMin). */
  startsInMin: number;
}

/**
 * Entries whose start is within their reminder lead window right now:
 * reminders fire from (startMin − reminderLeadMin) up to startMin.
 */
export function dueReminders<T extends ScheduleEntry>(entries: T[], clock: Clock): DueReminder<T>[] {
  const out: DueReminder<T>[] = [];
  for (const e of entries) {
    if (!e.reminderEnabled || !occursOn(e, clock.dow)) continue;
    const windowStart = e.startMin - Math.max(MIN_REMINDER_LEAD, e.reminderLeadMin);
    if (clock.min >= windowStart && clock.min < e.startMin) {
      out.push({ entry: e, startsInMin: e.startMin - clock.min });
    }
  }
  return out.sort((a, b) => a.startsInMin - b.startsInMin);
}

/** Next entry starting later today, if any (for the agenda's "up next"). */
export function nextEntry<T extends ScheduleEntry>(entries: T[], clock: Clock): T | null {
  const later = entries
    .filter((e) => occursOn(e, clock.dow) && e.startMin > clock.min)
    .sort((a, b) => a.startMin - b.startMin);
  return later[0] ?? null;
}
