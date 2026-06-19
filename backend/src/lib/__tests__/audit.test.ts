import { describe, expect, it } from 'vitest';
import { auditToCsv, csvField } from '../audit.js';

describe('audit CSV report', () => {
  it('escapes fields containing commas, quotes, or newlines (RFC 4180)', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('serialises rows with a header and ISO timestamps', () => {
    const csv = auditToCsv([
      {
        createdAt: new Date('2026-06-19T10:00:00.000Z'),
        action: 'auth.login',
        userId: 'u1',
        detail: null,
      },
      {
        createdAt: new Date('2026-06-19T10:05:00.000Z'),
        action: 'admin.user.updated',
        userId: 'admin1',
        detail: 'target=u1 {"role":"approver"}',
      },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('createdAt,action,userId,detail');
    expect(lines[1]).toBe('2026-06-19T10:00:00.000Z,auth.login,u1,');
    // detail contains a comma -> the whole field is quoted.
    expect(lines[2]).toBe(
      '2026-06-19T10:05:00.000Z,admin.user.updated,admin1,"target=u1 {""role"":""approver""}"',
    );
  });

  it('emits just the header for an empty report', () => {
    expect(auditToCsv([])).toBe('createdAt,action,userId,detail');
  });
});
