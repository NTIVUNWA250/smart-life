import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from '../auth.schemas.js';

describe('auth schemas', () => {
  it('accepts a minimal valid signup', () => {
    const r = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a short password and a bad email', () => {
    expect(signupSchema.safeParse({ name: 'Ada', email: 'ada@example.com', password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ name: 'Ada', email: 'nope', password: 'longenough1' }).success).toBe(false);
  });

  it('does not allow self-service admin role', () => {
    const r = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
      role: 'admin',
    });
    expect(r.success).toBe(false);
  });

  it('accepts an optional onboarding finance block and defaults the budget model', () => {
    const r = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
      finance: {
        incomeRwf: 100000,
        incomeFrequency: 'monthly',
        expectedPct: 40,
        unexpectedPct: 30,
        savingsPct: 30,
      },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.finance?.budgetModel).toBe('sixty_solution');
  });

  it('rejects a percentage above 100 in the finance block', () => {
    const r = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
      finance: { incomeRwf: 1, incomeFrequency: 'monthly', expectedPct: 40, unexpectedPct: 30, savingsPct: 101 },
    });
    expect(r.success).toBe(false);
  });

  it('login requires a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('updateProfile requires at least one field', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('changePassword enforces a minimum new-password length', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'longenough1' }).success).toBe(true);
  });
});
