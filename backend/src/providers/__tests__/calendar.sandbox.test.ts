import { describe, expect, it } from 'vitest';
import { SandboxCalendarProvider } from '../sandbox/calendar.sandbox.js';

// Calendar boundary (timetable reminders / Google Calendar in live mode).
describe('SandboxCalendarProvider', () => {
  it('assigns a unique id to each created event', async () => {
    const c = new SandboxCalendarProvider();
    const a = await c.createEvent('u1', {
      title: 'Study block',
      start: '2026-07-20T08:00:00.000Z',
      end: '2026-07-20T10:00:00.000Z',
    });
    const b = await c.createEvent('u1', {
      title: 'Focus',
      start: '2026-07-20T11:00:00.000Z',
      end: '2026-07-20T12:00:00.000Z',
    });
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBe('Study block');
  });

  it('lists only the requesting user’s events', async () => {
    const c = new SandboxCalendarProvider();
    await c.createEvent('u1', { title: 'A', start: 's', end: 'e' });
    await c.createEvent('u2', { title: 'B', start: 's', end: 'e' });
    const u1 = await c.listEvents('u1');
    expect(u1).toHaveLength(1);
    expect(u1[0]?.title).toBe('A');
    expect(await c.listEvents('u3')).toEqual([]);
  });
});
