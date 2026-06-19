import { beforeAll, describe, expect, it } from 'vitest';

// AES-256-GCM needs a 32-byte key; set one before the module reads env.
beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY ??= 'a'.repeat(64);
});

describe('crypto (AES-256-GCM field encryption)', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const { encryptField, decryptField } = await import('../crypto.js');
    const secret = 'please unblock my Instagram limit 🙏';
    const enc = encryptField(secret);
    expect(enc).not.toContain(secret);
    expect(enc.split('.')).toHaveLength(3); // iv.tag.ciphertext
    expect(decryptField(enc)).toBe(secret);
  });

  it('produces a unique ciphertext per call (random IV)', async () => {
    const { encryptField } = await import('../crypto.js');
    expect(encryptField('same')).not.toBe(encryptField('same'));
  });

  it('rejects tampered ciphertext (auth tag mismatch)', async () => {
    const { encryptField, decryptField } = await import('../crypto.js');
    const [iv, tag, data] = encryptField('top secret').split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    const tampered = [iv, tag, flipped.toString('base64')].join('.');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('hashes deterministically with sha256', async () => {
    const { sha256 } = await import('../crypto.js');
    expect(sha256('token')).toBe(sha256('token'));
    expect(sha256('token')).not.toBe(sha256('token2'));
    expect(sha256('token')).toHaveLength(64);
  });
});
