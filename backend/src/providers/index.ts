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
import { MomoPaymentProvider } from './live/payment.momo.js';
import { prisma } from '../lib/prisma.js';
import { decryptField } from '../lib/crypto.js';

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

/** The user's linked MoMo number, decrypted. Kept here so the adapter stays DB-free. */
async function momoMsisdnFor(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { momoMsisdnEnc: true },
  });
  if (!user?.momoMsisdnEnc) return null;
  try {
    return decryptField(user.momoMsisdnEnc);
  } catch (err) {
    // A wrong/rotated FIELD_ENCRYPTION_KEY must not deny every payment.
    logger.error('payment.momo.msisdn_decrypt_failed', { userId, err: String(err) });
    return null;
  }
}

function buildLive(): Providers {
  // Live adapters are added under providers/live/ and wired here. Each channel
  // falls back to its sandbox stub independently, so a half-configured live mode
  // still boots and the configured channels still work.
  const sandbox = buildSandbox();
  const { subscriptionKey, apiUser, apiKey } = env.momo;
  const momoConfigured = Boolean(subscriptionKey && apiUser && apiKey);

  if (!momoConfigured) {
    logger.warn(
      'PROVIDER_MODE=live but MOMO_SUBSCRIPTION_KEY/MOMO_API_USER/MOMO_API_KEY are incomplete; ' +
        'using the sandbox stub for momo (see npm run momo:provision)',
    );
  }
  logger.warn('PROVIDER_MODE=live: no live adapter for airtel or bank yet; using sandbox stubs');

  return {
    ...sandbox,
    payment: {
      ...sandbox.payment,
      momo: momoConfigured
        ? new MomoPaymentProvider(
            {
              baseUrl: env.momo.baseUrl,
              subscriptionKey,
              apiUser,
              apiKey,
              targetEnvironment: env.momo.targetEnvironment,
              timeoutMs: env.momo.timeoutMs,
            },
            { msisdnFor: momoMsisdnFor },
          )
        : sandbox.payment.momo,
    },
  };
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
