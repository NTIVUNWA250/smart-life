import { describe, expect, it } from 'vitest';
import {
  activeEntries,
  clockFromDate,
  dueReminders,
  entriesOverlap,
  isActiveAt,
  nextEntry,
  type ScheduleEntry,
} from '../timetable.schedule.js';

function entry(p: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'daysOfWeek' | 'startMin' | 'endMin'>): ScheduleEntry {
  return { isolation: false, reminderEnabled: true, reminderLeadMin: 5, ...p };
}

// Mon 08:00–10:00 study
const study = entry({ id: 'study', daysOfWeek: [1], startMin: 480, endMin: 600, isolation: true });

describe('isActiveAt', () => {
  it('is active inside its window on a matching day', () => {
    expect(isActiveAt(study, { dow: 1, min: 540 })).toBe(true); // Mon 09:00
  });
  it('is inactive before/after the window and on other days', () => {
    expect(isActiveAt(study, { dow: 1, min: 479 })).toBe(false); // 07:59
    expect(isActiveAt(study, { dow: 1, min: 600 })).toBe(false); // 10:00 (exclusive end)
    expect(isActiveAt(study, { dow: 2, min: 540 })).toBe(false); // Tue
  });
});

describe('dueReminders', () => {
  it('fires within the lead window before the start', () => {
    expect(dueReminders([study], { dow: 1, min: 476 }).map((r) => r.startsInMin)).toEqual([4]); // 07:56 → 4 min
    expect(dueReminders([study], { dow: 1, min: 475 })).toHaveLength(1); // exactly 5 min before
  });
  it('does not fire outside the window or once started', () => {
    expect(dueReminders([study], { dow: 1, min: 474 })).toHaveLength(0); // too early
    expect(dueReminders([study], { dow: 1, min: 480 })).toHaveLength(0); // already started
  });
  it('respects a longer custom lead time', () => {
    const e = entry({ id: 'x', daysOfWeek: [3], startMin: 600, endMin: 660, reminderLeadMin: 15 });
    expect(dueReminders([e], { dow: 3, min: 590 })).toHaveLength(1); // 10 min before, within 15
  });
  it('skips entries with reminders disabled', () => {
    const e = entry({ id: 'x', daysOfWeek: [1], startMin: 480, endMin: 600, reminderEnabled: false });
    expect(dueReminders([e], { dow: 1, min: 476 })).toHaveLength(0);
  });
});

describe('entriesOverlap', () => {
  it('detects same-day time clashes', () => {
    const a = entry({ id: 'a', daysOfWeek: [1, 2], startMin: 480, endMin: 600 });
    const b = entry({ id: 'b', daysOfWeek: [2], startMin: 540, endMin: 660 });
    expect(entriesOverlap(a, b)).toBe(true);
  });
  it('ignores clashes on non-shared days', () => {
    const a = entry({ id: 'a', daysOfWeek: [1], startMin: 480, endMin: 600 });
    const b = entry({ id: 'b', daysOfWeek: [2], startMin: 480, endMin: 600 });
    expect(entriesOverlap(a, b)).toBe(false);
  });
  it('treats touching ranges (end == start) as non-overlapping', () => {
    const a = entry({ id: 'a', daysOfWeek: [1], startMin: 480, endMin: 600 });
    const b = entry({ id: 'b', daysOfWeek: [1], startMin: 600, endMin: 660 });
    expect(entriesOverlap(a, b)).toBe(false);
  });
});

describe('activeEntries / nextEntry', () => {
  const lunch = entry({ id: 'lunch', daysOfWeek: [1], startMin: 720, endMin: 780 });
  it('lists what is running and the next upcoming entry', () => {
    expect(activeEntries([study, lunch], { dow: 1, min: 540 }).map((e) => e.id)).toEqual(['study']);
    expect(nextEntry([study, lunch], { dow: 1, min: 540 })?.id).toBe('lunch');
    expect(nextEntry([study, lunch], { dow: 1, min: 800 })).toBeNull();
  });
});

describe('clockFromDate', () => {
  it('reads day-of-week and minute-of-day (UTC)', () => {
    const c = clockFromDate(new Date('2026-06-22T08:30:00Z')); // Monday
    expect(c).toEqual({ dow: 1, min: 510 });
  });
});
