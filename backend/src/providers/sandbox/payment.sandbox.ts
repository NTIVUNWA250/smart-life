import type { PaymentChannel, PaymentProvider, PaymentStatus } from '../types.js';
import { logger } from '../../lib/logger.js';

/**
 * In-memory payment provider. Models a per-user "blocked" flag per channel.
 * Real mobile-money/bank APIs have no generic "freeze wallet" primitive — in live
 * mode this is approximated by withholding payment authorisation for transfers
 * initiated through SMART LIFE. See docs/INTEGRATIONS.md.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly channel: PaymentChannel;
  private blocked = new Set<string>();

  constructor(channel: PaymentChannel) {
    this.channel = channel;
  }

  async block(userId: string): Promise<PaymentStatus> {
    this.blocked.add(userId);
    logger.info('payment.block', { channel: this.channel, userId });
    return this.status(userId);
  }

  async unblock(userId: string): Promise<PaymentStatus> {
    this.blocked.delete(userId);
    logger.info('payment.unblock', { channel: this.channel, userId });
    return this.status(userId);
  }

  async status(userId: string): Promise<PaymentStatus> {
    return { channel: this.channel, blocked: this.blocked.has(userId) };
  }

  async authorize(userId: string, _amountRwf: number): Promise<boolean> {
    return !this.blocked.has(userId);
  }
}
