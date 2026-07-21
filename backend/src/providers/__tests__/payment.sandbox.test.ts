import { describe, expect, it } from 'vitest';
import { SandboxPaymentProvider } from '../sandbox/payment.sandbox.js';

// FR4: outbound payments must be authorised, and a blocked wallet must be denied.
describe('SandboxPaymentProvider', () => {
  it('starts unblocked and authorises payments', async () => {
    const p = new SandboxPaymentProvider('momo');
    expect(p.channel).toBe('momo');
    expect((await p.status('u1')).blocked).toBe(false);
    expect(await p.authorize('u1', 5000)).toBe(true);
  });

  it('denies authorisation once a user is blocked', async () => {
    const p = new SandboxPaymentProvider('airtel');
    await p.block('u1');
    expect((await p.status('u1')).blocked).toBe(true);
    expect(await p.authorize('u1', 1000)).toBe(false);
  });

  it('unblock restores authorisation', async () => {
    const p = new SandboxPaymentProvider('bank');
    await p.block('u1');
    await p.unblock('u1');
    expect((await p.status('u1')).blocked).toBe(false);
    expect(await p.authorize('u1', 1000)).toBe(true);
  });

  it('tracks block state per user, not globally', async () => {
    const p = new SandboxPaymentProvider('momo');
    await p.block('u1');
    expect((await p.status('u1')).blocked).toBe(true);
    expect((await p.status('u2')).blocked).toBe(false);
    expect(await p.authorize('u2', 2000)).toBe(true);
  });

  it('block/unblock are idempotent', async () => {
    const p = new SandboxPaymentProvider('momo');
    await p.block('u1');
    await p.block('u1');
    expect((await p.status('u1')).blocked).toBe(true);
    await p.unblock('u1');
    await p.unblock('u1');
    expect((await p.status('u1')).blocked).toBe(false);
  });
});
