import { describe, expect, it } from 'vitest';
import { assertWholeRwf, formatRwf } from '../money.js';

describe('money', () => {
  it('formats RWF with thousands separators', () => {
    expect(formatRwf(12345)).toBe('RWF 12,345');
    expect(formatRwf(0)).toBe('RWF 0');
  });

  it('rejects fractional or negative francs', () => {
    expect(() => assertWholeRwf(10.5)).toThrow();
    expect(() => assertWholeRwf(-1)).toThrow();
    expect(() => assertWholeRwf(1000)).not.toThrow();
  });
});
