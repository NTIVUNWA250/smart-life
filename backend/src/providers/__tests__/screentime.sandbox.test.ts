import { describe, expect, it } from 'vitest';
import { SandboxScreenTimeProvider } from '../sandbox/screentime.sandbox.js';

// FR5: usage reported by the mobile OS is stored and echoed back for policy checks.
describe('SandboxScreenTimeProvider', () => {
  it('returns an empty list for a user with no reported usage', async () => {
    const p = new SandboxScreenTimeProvider();
    expect(await p.getUsage('u1')).toEqual([]);
  });

  it('stores and returns reported usage per user', async () => {
    const p = new SandboxScreenTimeProvider();
    p.setUsage('u1', [{ appOrSite: 'com.instagram.android', usedMin: 42 }]);
    expect(await p.getUsage('u1')).toEqual([
      { appOrSite: 'com.instagram.android', usedMin: 42 },
    ]);
    expect(await p.getUsage('u2')).toEqual([]);
  });

  it('overwrites previously reported usage on the next report', async () => {
    const p = new SandboxScreenTimeProvider();
    p.setUsage('u1', [{ appOrSite: 'youtube.com', usedMin: 10 }]);
    p.setUsage('u1', [{ appOrSite: 'youtube.com', usedMin: 25 }]);
    expect(await p.getUsage('u1')).toEqual([{ appOrSite: 'youtube.com', usedMin: 25 }]);
  });

  it('enforceBlock resolves without throwing (device-side no-op in sandbox)', async () => {
    const p = new SandboxScreenTimeProvider();
    await expect(p.enforceBlock('u1', 'com.instagram.android', true)).resolves.toBeUndefined();
  });
});
