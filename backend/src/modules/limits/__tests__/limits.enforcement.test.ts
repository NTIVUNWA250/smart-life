import { beforeEach, describe, expect, it, vi } from 'vitest';

// Persistence and side-effecting providers are mocked so the decision logic in
// checkPayment can be exercised without PostgreSQL, like the rest of the suite.
const prismaMock = {
  goal: { findMany: vi.fn() },
  financeProfile: { findUnique: vi.fn() },
  transaction: { aggregate: vi.fn() },
  spendingLimit: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
};

vi.mock('../../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../../lib/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../providers/index.js', () => ({
  blockAllPayments: vi.fn(),
  unblockAllPayments: vi.fn(),
  providers: { payment: { momo: { authorize: vi.fn().mockResolvedValue(true) } } },
}));

const { checkPayment } = await import('../limits.service.js');

/** 60% expenses / 10% unexpected / 30% savings on 300k, with 90k rent on the 1st. */
const profile = {
  incomeRwf: 300_000,
  incomeFrequency: 'monthly',
  expectedPct: 60,
  unexpectedPct: 10,
  savingsPct: 30,
  heavyExpenseRwf: 90_000,
  heavyExpenseDay: 1,
  weekendBoostPct: 30,
};

/** Monthly: 180k expenses - 90k rent = 90k + 30k buffer = 120k spread over the month. */
function arrange({
  spentTodayRwf,
  spentMonthRwf = 0,
  overridePending = false,
}: {
  spentTodayRwf: number;
  spentMonthRwf?: number;
  overridePending?: boolean;
}) {
  prismaMock.goal.findMany.mockResolvedValue([]);
  prismaMock.financeProfile.findUnique.mockResolvedValue(profile);
  prismaMock.spendingLimit.findFirst.mockResolvedValue(null);
  prismaMock.spendingLimit.create.mockImplementation(({ data }: { data: object }) => ({
    id: 'limit-1',
    unexpectedIncomeRwf: 0,
    overridePending,
    ...data,
  }));
  prismaMock.spendingLimit.update.mockResolvedValue({ id: 'limit-1' });
  // First aggregate call is the month's spend, second is today's.
  prismaMock.transaction.aggregate
    .mockResolvedValueOnce({ _sum: { amountRwf: spentMonthRwf } })
    .mockResolvedValueOnce({ _sum: { amountRwf: spentTodayRwf } });
}

describe('checkPayment (daily enforcement)', () => {
  beforeEach(() => vi.clearAllMocks());

  // Fri 26 Jun 2026: weekday rate, and not the heavy-expense day.
  const weekday = new Date('2026-06-26T10:00:00Z');

  it('allows an expense inside the day budget', async () => {
    arrange({ spentTodayRwf: 0 });
    const res = await checkPayment('u1', 3_000, weekday);
    expect(res.allowed).toBe(true);
    // 120k / (22 weekdays + 1.3 x 8 weekend days) = 3,703 a weekday.
    expect(res.daily?.allowanceRwf).toBe(3_703);
  });

  it('refuses an expense over the day budget even when the month has room', async () => {
    arrange({ spentTodayRwf: 0 });
    const res = await checkPayment('u1', 50_000, weekday);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("today's budget");
    // Well within the monthly limit - only the daily rule rejected it.
    expect(res.limit.spentRwf + 50_000).toBeLessThan(res.limit.limitRwf);
  });

  it('counts what was already spent today', async () => {
    arrange({ spentTodayRwf: 3_500 });
    const res = await checkPayment('u1', 500, weekday);
    expect(res.allowed).toBe(false);
    expect(res.daily?.remainingRwf).toBe(203);
  });

  it('grants the rent lump as extra headroom on the heavy-expense day', async () => {
    arrange({ spentTodayRwf: 0 });
    // Mon 1 Jun 2026 is heavyExpenseDay, so rent may be paid on top of the day rate.
    const res = await checkPayment('u1', 90_000, new Date('2026-06-01T10:00:00Z'));
    expect(res.allowed).toBe(true);
    expect(res.daily?.allowanceRwf).toBe(93_703); // the day rate plus the rent lump
  });
});

describe('checkPayment (approved override, FR6)', () => {
  beforeEach(() => vi.clearAllMocks());

  const weekday = new Date('2026-06-26T10:00:00Z');

  it('lets an approved over-limit expense through', async () => {
    arrange({ spentTodayRwf: 0, overridePending: true });
    const res = await checkPayment('u1', 50_000, weekday, true);
    expect(res.allowed).toBe(true);
    expect(res.usedOverride).toBe(true);
  });

  it('consumes the override so it only works once', async () => {
    arrange({ spentTodayRwf: 0, overridePending: true });
    await checkPayment('u1', 50_000, weekday, true);
    expect(prismaMock.spendingLimit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ overridePending: false }) }),
    );
  });

  it('does not spend the override on a read-only check', async () => {
    arrange({ spentTodayRwf: 0, overridePending: true });
    const res = await checkPayment('u1', 50_000, weekday);
    expect(res.allowed).toBe(true);
    expect(prismaMock.spendingLimit.update).not.toHaveBeenCalled();
  });

  it('still refuses when no override is pending', async () => {
    arrange({ spentTodayRwf: 0, overridePending: false });
    const res = await checkPayment('u1', 50_000, weekday, true);
    expect(res.allowed).toBe(false);
  });
});
