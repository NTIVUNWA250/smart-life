import { describe, expect, it, vi } from 'vitest';
import { MomoApiError, MomoPaymentProvider } from '../live/payment.momo.js';

// The MTN Open API is exercised through an injected fetch, so these tests assert
// the exact contract we send MTN (headers, auth, paths) and how we react to each
// answer — without needing a developer-portal subscription key.

const CFG = {
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  subscriptionKey: 'sub-key',
  apiUser: 'api-user-uuid',
  apiKey: 'api-key',
  targetEnvironment: 'sandbox',
  timeoutMs: 5_000,
};

const TOKEN_BODY = { access_token: 'tok-1', token_type: 'Bearer', expires_in: 3600 };

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A fetch double that answers the token endpoint and delegates the rest. */
function fakeFetch(handler: (url: string, init: RequestInit) => Response) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/collection/token/')) return jsonRes(TOKEN_BODY);
    return handler(url, init ?? {});
  }) as unknown as typeof globalThis.fetch;
}

function provider(opts: {
  fetch: typeof globalThis.fetch;
  msisdn?: string | null;
  now?: () => number;
}) {
  return new MomoPaymentProvider(CFG, {
    fetch: opts.fetch,
    now: opts.now,
    msisdnFor: async () => opts.msisdn ?? null,
  });
}

describe('MomoPaymentProvider — block state', () => {
  it('refuses a blocked user without calling MTN at all', async () => {
    const f = fakeFetch(() => jsonRes(true));
    const p = provider({ fetch: f, msisdn: '250788123456' });

    await p.block('u1');
    expect(await p.authorize('u1', 5_000)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(await p.status('u1')).toEqual({ channel: 'momo', blocked: true });
  });

  it('unblock restores authorisation and is scoped to one user', async () => {
    const f = fakeFetch(() => jsonRes(true));
    const p = provider({ fetch: f, msisdn: '250788123456' });

    await p.block('u1');
    await p.unblock('u1');
    expect(await p.authorize('u1', 5_000)).toBe(true);
    expect((await p.status('u2')).blocked).toBe(false);
  });
});

describe('MomoPaymentProvider — account-holder check', () => {
  it('sends the token, target environment and subscription key MTN requires', async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const f = fakeFetch((url, init) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return jsonRes(true);
    });

    expect(await provider({ fetch: f, msisdn: '250788123456' }).authorize('u1', 5_000)).toBe(true);
    expect(seen!.url).toBe(
      'https://sandbox.momodeveloper.mtn.com/collection/v1_0/accountholder/msisdn/250788123456/active',
    );
    expect(seen!.headers).toMatchObject({
      Authorization: 'Bearer tok-1',
      'X-Target-Environment': 'sandbox',
      'Ocp-Apim-Subscription-Key': 'sub-key',
    });
  });

  it('skips MTN entirely when the user has no linked wallet', async () => {
    const f = fakeFetch(() => jsonRes(true));
    expect(await provider({ fetch: f, msisdn: null }).authorize('u1', 5_000)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('refuses when MTN does not know the account holder (404)', async () => {
    const f = fakeFetch(() => jsonRes({ message: 'not found' }, 404));
    expect(await provider({ fetch: f, msisdn: '250788000000' }).authorize('u1', 5_000)).toBe(false);
  });

  it('allows when MTN is unreachable — SMART LIFE limits remain authoritative', async () => {
    const f = vi.fn(async () => {
      throw new Error('ETIMEDOUT');
    }) as unknown as typeof globalThis.fetch;
    expect(await provider({ fetch: f, msisdn: '250788123456' }).authorize('u1', 5_000)).toBe(true);
  });

  it('allows when MTN returns a 500 rather than a verdict', async () => {
    const f = fakeFetch(() => jsonRes({ message: 'boom' }, 500));
    expect(await provider({ fetch: f, msisdn: '250788123456' }).authorize('u1', 5_000)).toBe(true);
  });
});

describe('MomoPaymentProvider — access token', () => {
  it('fetches the token once and reuses it across calls', async () => {
    let tokenCalls = 0;
    const f = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/collection/token/')) {
        tokenCalls += 1;
        return jsonRes(TOKEN_BODY);
      }
      return jsonRes(true);
    }) as unknown as typeof globalThis.fetch;

    const p = provider({ fetch: f, msisdn: '250788123456' });
    await p.authorize('u1', 1);
    await p.authorize('u1', 2);
    await p.authorize('u1', 3);
    expect(tokenCalls).toBe(1);
  });

  it('re-fetches once the cached token nears expiry', async () => {
    let tokenCalls = 0;
    let clock = 1_000_000;
    const f = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/collection/token/')) {
        tokenCalls += 1;
        return jsonRes(TOKEN_BODY);
      }
      return jsonRes(true);
    }) as unknown as typeof globalThis.fetch;

    const p = provider({ fetch: f, msisdn: '250788123456', now: () => clock });
    await p.authorize('u1', 1);
    expect(tokenCalls).toBe(1);

    clock += 3600 * 1000; // Past expires_in, and past the 60s refresh skew.
    await p.authorize('u1', 2);
    expect(tokenCalls).toBe(2);
  });

  it('drops a rejected token so a 401 does not wedge the provider', async () => {
    let tokenCalls = 0;
    let unauthorized = true;
    const f = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/collection/token/')) {
        tokenCalls += 1;
        return jsonRes(TOKEN_BODY);
      }
      if (unauthorized) {
        unauthorized = false;
        return jsonRes({ message: 'expired' }, 401);
      }
      return jsonRes(true);
    }) as unknown as typeof globalThis.fetch;

    const p = provider({ fetch: f, msisdn: '250788123456' });
    expect(await p.authorize('u1', 1)).toBe(true); // 401 → fail open
    await p.authorize('u1', 2);
    expect(tokenCalls).toBe(2); // Token was discarded and re-fetched.
  });
});

describe('MomoPaymentProvider — diagnostics', () => {
  it('reads the Collections balance', async () => {
    const f = fakeFetch(() => jsonRes({ availableBalance: '1000', currency: 'EUR' }));
    const balance = await provider({ fetch: f }).accountBalance();
    expect(balance).toEqual({ availableBalance: '1000', currency: 'EUR' });
  });

  it('surfaces MTN failures as MomoApiError with the status', async () => {
    const f = fakeFetch(() => jsonRes({ message: 'nope' }, 403));
    await expect(provider({ fetch: f }).accountBalance()).rejects.toBeInstanceOf(MomoApiError);
  });
});
