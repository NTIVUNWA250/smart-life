import type { CalendarEvent, CalendarProvider } from '../types.js';

/** In-memory calendar. Replaced by Google Calendar API in live mode. */
export class SandboxCalendarProvider implements CalendarProvider {
  private events = new Map<string, CalendarEvent[]>();
  private seq = 0;

  async createEvent(
    userId: string,
    event: Omit<CalendarEvent, 'id'>,
  ): Promise<CalendarEvent> {
    const created: CalendarEvent = { id: `evt_${++this.seq}`, ...event };
    const list = this.events.get(userId) ?? [];
    list.push(created);
    this.events.set(userId, list);
    return created;
  }

  async listEvents(userId: string): Promise<CalendarEvent[]> {
    return this.events.get(userId) ?? [];
  }
}
