import type { PaymentProvider, PaymentStatus } from '../types.js';
import { logger } from '../../lib/logger.js';

/**
 * MTN MoMo Open API adapter (Collections product).
 *
 * What MTN can and cannot do for FR4, stated plainly because it shapes this class:
 *
 * - There is **no "freeze this wallet" endpoint**. Nothing in the Open API lets a
 *   third party stop a subscriber from spending in the MTN app. So `block`/`unblock`
 *   remain a SMART LIFE-side decision, exactly as in the sandbox stub, and the real
 *   enforcement is the server-side check in `limits.checkPayment`.
 * - What MTN *can* tell us is whether an MSISDN is a live, reachable MoMo account.
 *   `authorize` uses that to refuse payments aimed at a dead or unlinked wallet.
 *
 * Consequently this adapter makes MTN an *additional* gate, never the only one.
 * See docs/INTEGRATIONS.md.
 */

export interface MomoConfig {
  /** e.g. https://sandbox.momodeveloper.mtn.com */
  baseUrl: string;
  /** Ocp-Apim-Subscription-Key from the MoMo developer portal. */
  subscriptionKey: string;
  /** API user id (a UUID) — see `npm run momo:provision`. */
  apiUser: string;
  apiKey: string;
  /** X-Target-Environment: `sandbox`, or the production environment name. */
  targetEnvironment: string;
  timeoutMs?: number;
}

export interface MomoDeps {
  /** Resolves a SMART LIFE user to their MoMo MSISDN, or null if none is linked. */
  msisdnFor: (userId: string) => Promise<string | null>;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
}

export class MomoApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`MoMo ${path} failed with ${status}: ${body.slice(0, 200)}`);
    this.name = 'MomoApiError';
  }
}

/** Refresh this many ms before the token actually expires, to avoid a race. */
const TOKEN_SKEW_MS = 60_000;

export class MomoPaymentProvider implements PaymentProvider {
  readonly channel = 'momo' as const;

  private readonly blocked = new Set<string>();
  private token: { value: string; expiresAt: number } | null = null;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly now: () => number;

  constructor(
    private readonly cfg: MomoConfig,
    private readonly deps: MomoDeps,
  ) {
    this.fetchImpl = deps.fetch ?? globalThis.fetch;
    this.now = deps.now ?? Date.now;
  }

  // --- SMART LIFE-side block state -------------------------------------------
  // Held in memory, like the sandbox stub, because MTN exposes no freeze
  // primitive to persist it to. It is not the source of truth: a restart clears
  // it, and `recomputeCurrentLimit` re-applies blocking on the next limit
  // recalculation, so the state self-heals.

  async block(userId: string): Promise<PaymentStatus> {
    this.blocked.add(userId);
    logger.info('payment.block', { channel: this.channel, userId, mode: 'momo-live' });
    return this.status(userId);
  }

  async unblock(userId: string): Promise<PaymentStatus> {
    this.blocked.delete(userId);
    logger.info('payment.unblock', { channel: this.channel, userId, mode: 'momo-live' });
    return this.status(userId);
  }

  async status(userId: string): Promise<PaymentStatus> {
    return { channel: this.channel, blocked: this.blocked.has(userId) };
  }

  /**
   * Authorises a proposed outbound payment.
   *
   * Refuses if SMART LIFE has blocked the user, or if MTN reports their linked
   * MSISDN is not an active account holder. If MTN is unreachable this **allows**
   * the payment: `limits.checkPayment` has already applied the budget rules that
   * actually matter, and failing closed would mean an MTN outage stops students
   * recording spending they have genuinely made.
   */
  async authorize(userId: string, _amountRwf: number): Promise<boolean> {
    if (this.blocked.has(userId)) return false;

    const msisdn = await this.deps.msisdnFor(userId);
    if (!msisdn) return true; // No linked wallet — nothing for MTN to rule on.

    try {
      const active = await this.isAccountActive(msisdn);
      if (!active) {
        logger.warn('payment.momo.inactive_account', { userId });
      }
      return active;
    } catch (err) {
      logger.warn('payment.momo.unreachable', {
        userId,
        err: String(err),
        outcome: 'allowed; SMART LIFE limits remain authoritative',
      });
      return true;
    }
  }

  // --- MTN Open API ----------------------------------------------------------

  /**
   * GET /collection/v1_0/accountholder/msisdn/{msisdn}/active.
   *
   * 200 (body `true`) means active; 404 means MTN has no such account holder, which
   * is a definite "no" rather than a failure — it must not be swallowed by
   * `authorize`'s fail-open path, so it is translated here instead of throwing.
   */
  async isAccountActive(msisdn: string): Promise<boolean> {
    let res: Response;
    try {
      res = await this.call(
        `/collection/v1_0/accountholder/msisdn/${encodeURIComponent(msisdn)}/active`,
        { headers: await this.collectionHeaders() },
      );
    } catch (err) {
      if (err instanceof MomoApiError && err.status === 404) return false;
      throw err;
    }
    const body = (await res.text()).trim();
    return body === '' || body.toLowerCase() === 'true';
  }

  /** GET /collection/v1_0/account/balance — diagnostics; verifies credentials work. */
  async accountBalance(): Promise<{ availableBalance: string; currency: string }> {
    const res = await this.call('/collection/v1_0/account/balance', {
      headers: await this.collectionHeaders(),
    });
    return (await res.json()) as { availableBalance: string; currency: string };
  }

  private async collectionHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.accessToken()}`,
      'X-Target-Environment': this.cfg.targetEnvironment,
      'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
    };
  }

  /**
   * POST /collection/token/ with HTTP Basic (apiUser:apiKey). Cached until shortly
   * before `expires_in` elapses — MTN rate-limits token creation.
   */
  private async accessToken(): Promise<string> {
    const cached = this.token;
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const basic = Buffer.from(`${this.cfg.apiUser}:${this.cfg.apiKey}`).toString('base64');
    const res = await this.call('/collection/token/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
      },
    });
    const body = (await res.json()) as { access_token: string; expires_in: number };
    const ttlMs = Math.max(0, (body.expires_in ?? 3600) * 1000 - TOKEN_SKEW_MS);
    this.token = { value: body.access_token, expiresAt: this.now() + ttlMs };
    return body.access_token;
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      // A stale token must not wedge the provider for the rest of its TTL.
      if (res.status === 401) this.token = null;
      throw new MomoApiError(res.status, path, await res.text().catch(() => ''));
    }
    return res;
  }
}
