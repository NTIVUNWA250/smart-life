// Provider interfaces. Every external integration is accessed only through these,
// so SMART LIFE's business logic stays real and testable without commercial
// credentials. See docs/INTEGRATIONS.md.

export type PaymentChannel = 'momo' | 'airtel' | 'bank';

export interface PaymentStatus {
  channel: PaymentChannel;
  blocked: boolean;
}

/** Blocks/unblocks outbound payments for a user across mobile-money & bank channels. */
export interface PaymentProvider {
  readonly channel: PaymentChannel;
  block(userId: string): Promise<PaymentStatus>;
  unblock(userId: string): Promise<PaymentStatus>;
  status(userId: string): Promise<PaymentStatus>;
  /** Authorise a proposed outbound payment. Returns false if currently blocked. */
  authorize(userId: string, amountRwf: number): Promise<boolean>;
}

export interface ScreenUsage {
  appOrSite: string;
  usedMin: number;
}

/** OS-level screen-time tracking & enforcement (runs device-side in production). */
export interface ScreenTimeProvider {
  getUsage(userId: string): Promise<ScreenUsage[]>;
  enforceBlock(userId: string, appOrSite: string, blocked: boolean): Promise<void>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
}

/** Calendar scheduling (Google Calendar in production). */
export interface CalendarProvider {
  createEvent(userId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent>;
  listEvents(userId: string): Promise<CalendarEvent[]>;
}
