import { beforeAll, describe, expect, it } from 'vitest';

// providers/index reads env at import time, so seed the same defaults app.test.ts uses.
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/smartlife_test?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
  process.env.FIELD_ENCRYPTION_KEY ??= 'a'.repeat(64);
});

describe('providers (sandbox mode)', () => {
  it('exposes all three payment channels', async () => {
    const { providers } = await import('../index.js');
    expect(Object.keys(providers.payment).sort()).toEqual(['airtel', 'bank', 'momo']);
  });

  it('blockAllPayments blocks every channel, unblockAllPayments clears them', async () => {
    const { providers, blockAllPayments, unblockAllPayments } = await import('../index.js');

    await blockAllPayments('u1');
    for (const channel of Object.values(providers.payment)) {
      expect((await channel.status('u1')).blocked).toBe(true);
    }

    await unblockAllPayments('u1');
    for (const channel of Object.values(providers.payment)) {
      expect((await channel.status('u1')).blocked).toBe(false);
    }
  });
});
