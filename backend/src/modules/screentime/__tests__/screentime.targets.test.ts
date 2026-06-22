import { describe, expect, it } from 'vitest';
import { normalizeTarget, normalizeWebTarget } from '../screentime.targets.js';

describe('normalizeWebTarget', () => {
  it('accepts a bare domain', () => {
    expect(normalizeWebTarget('instagram.com')).toBe('instagram.com');
  });

  it('accepts a full URL and reduces it to the host', () => {
    expect(normalizeWebTarget('https://www.tiktok.com/foryou?x=1')).toBe('tiktok.com');
  });

  it('lower-cases and strips a leading www.', () => {
    expect(normalizeWebTarget('WWW.YouTube.COM')).toBe('youtube.com');
  });

  it('rejects values without a valid TLD', () => {
    expect(() => normalizeWebTarget('not a url')).toThrow();
    expect(() => normalizeWebTarget('localhost')).toThrow();
    expect(() => normalizeWebTarget('')).toThrow();
  });
});

describe('normalizeTarget', () => {
  it('normalises a url target and defaults the label to the host', () => {
    expect(normalizeTarget('url', 'https://instagram.com/feed')).toEqual({
      appOrSite: 'instagram.com',
      kind: 'url',
      label: 'instagram.com',
    });
  });

  it('keeps an app identifier as-is and uses the provided label', () => {
    expect(normalizeTarget('app', 'com.instagram.android', 'Instagram')).toEqual({
      appOrSite: 'com.instagram.android',
      kind: 'app',
      label: 'Instagram',
    });
  });

  it('rejects an empty app identifier', () => {
    expect(() => normalizeTarget('app', '   ')).toThrow();
  });
});
