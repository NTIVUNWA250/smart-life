import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import type {
  CalendarProvider,
  PaymentChannel,
  PaymentProvider,
  ScreenTimeProvider,
} from './types.js';
import { SandboxPaymentProvider } from './sandbox/payment.sandbox.js';
import { SandboxScreenTimeProvider } from './sandbox/screentime.sandbox.js';
import { SandboxCalendarProvider } from './sandbox/calendar.sandbox.js';

export interface Providers {
  payment: Record<PaymentChannel, PaymentProvider>;
  screentime: ScreenTimeProvider;
  calendar: CalendarProvider;
}

function buildSandbox(): Providers {
  return {
    payment: {
      momo: new SandboxPaymentProvider('momo'),
      airtel: new SandboxPaymentProvider('airtel'),
      bank: new SandboxPaymentProvider('bank'),
    },
    screentime: new SandboxScreenTimeProvider(),
    calendar: new SandboxCalendarProvider(),
  };
}

function buildLive(): Providers {
  // Live SDK implementations are added under providers/live/ and wired here.
  // Until each is implemented, fall back to sandbox so the app still boots.
  logger.warn('PROVIDER_MODE=live but live adapters are not yet implemented; using sandbox');
  return buildSandbox();
}

export const providers: Providers =
  env.providerMode === 'live' ? buildLive() : buildSandbox();

/** Convenience: act on every payment channel at once. */
export async function blockAllPayments(userId: string): Promise<void> {
  await Promise.all(Object.values(providers.payment).map((p) => p.block(userId)));
}

export async function unblockAllPayments(userId: string): Promise<void> {
  await Promise.all(Object.values(providers.payment).map((p) => p.unblock(userId)));
}

export type { PaymentChannel } from './types.js';
