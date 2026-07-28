import { z } from 'zod';

// `admin` is an internal/developer-only role — it is intentionally NOT selectable
// at sign-up. Admins are provisioned via seed/admin tooling, not self-service.
export const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['student', 'approver']).optional(),
  isMinor: z.boolean().optional(),
  // Optional budget captured during onboarding; seeds the auto savings goal.
  finance: z
    .object({
      incomeRwf: z.number().int().nonnegative(),
      incomeFrequency: z.enum(['daily', 'monthly', 'yearly']),
      budgetModel: z.string().min(1).max(40).default('sixty_solution'),
      expectedPct: z.number().int().min(0).max(100),
      unexpectedPct: z.number().int().min(0).max(100),
      savingsPct: z.number().int().min(0).max(100),
      expenseFrequency: z.enum(['daily', 'monthly', 'yearly']).optional(),
      heavyExpenseRwf: z.number().int().nonnegative().optional(),
      heavyExpenseDay: z.number().int().min(1).max(28).optional(),
      weekendBoostPct: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Settings: update profile (name/email/MoMo wallet). At least one field required.
export const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    email: z.string().email().optional(),
    // MTN expects a bare international MSISDN — digits only, no '+' or spaces
    // (Rwanda: 2507XXXXXXXX). Explicit null unlinks the wallet.
    momoMsisdn: z
      .string()
      .regex(/^\d{6,15}$/, 'Enter the number in international format, digits only (e.g. 250788123456)')
      .nullable()
      .optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.email !== undefined || v.momoMsisdn !== undefined,
    { message: 'Provide a name, email or MoMo number to update' },
  );

// Settings: change password (requires the current one).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
