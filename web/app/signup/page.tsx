'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import type { Frequency } from '@/lib/types';
import { findModel, toMonthly, suggestBudgetClient, DEFAULT_MODEL_ID } from '@/lib/budget';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { BudgetFields, isBudgetValid, type BudgetValue } from '@/components/BudgetFields';
import { ThemeToggle } from '@/components/ThemeToggle';

type SignupRole = 'student' | 'approver';

const DEFAULT_BUDGET: BudgetValue = (() => {
  const m = findModel(DEFAULT_MODEL_ID)!;
  return {
    budgetModel: m.id,
    expectedPct: m.expectedPct,
    unexpectedPct: m.unexpectedPct,
    savingsPct: m.savingsPct,
    expenseFrequency: 'monthly',
  };
})();

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  // Step 1 — account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('student');
  const [isMinor, setIsMinor] = useState(false);
  // Step 2 — budget (students only)
  const [income, setIncome] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>('monthly');
  const [budget, setBudget] = useState<BudgetValue>(DEFAULT_BUDGET);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const monthlyIncome = useMemo(
    () => toMonthly(Number(income) || 0, incomeFrequency),
    [income, incomeFrequency],
  );

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await signup({
        name,
        email,
        password,
        role,
        isMinor,
        finance:
          role === 'student' && income !== ''
            ? {
                incomeRwf: Number(income),
                incomeFrequency,
                budgetModel: budget.budgetModel,
                expectedPct: budget.expectedPct,
                unexpectedPct: budget.unexpectedPct,
                savingsPct: budget.savingsPct,
                expenseFrequency: budget.expenseFrequency,
              }
            : undefined,
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onAccountNext(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (role === 'approver') {
      void submit();
    } else {
      setStep(2);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const budgetOk = isBudgetValid(budget);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700 dark:text-brand-300">SMART LIFE</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 1 ? 'Create your account.' : 'Set up your monthly budget.'}
          </p>
        </div>

        {step === 1 ? (
          <Card title="Sign up">
            <form onSubmit={onAccountNext} className="space-y-4">
              {error && <Alert tone="error">{error}</Alert>}
              <Field label="Name">
                <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Account type">
                <Select value={role} onChange={(e) => setRole(e.target.value as SignupRole)}>
                  <option value="student">Student</option>
                  <option value="approver">Peer / parent approver</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => setIsMinor(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                I am a minor (goal edits need a parent&apos;s approval)
              </label>
              <Button type="submit" disabled={submitting} className="w-full">
                {role === 'approver'
                  ? submitting
                    ? 'Creating account…'
                    : 'Create account'
                  : 'Next: budget →'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                Sign in
              </Link>
            </p>
          </Card>
        ) : (
          <Card title="Your monthly budget">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="space-y-4"
            >
              {error && <Alert tone="error">{error}</Alert>}
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pick a budget model (or customise). Savings must stay at or above 30%. You can edit
                this once a month.
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Full income">
                    <Input
                      type="number"
                      min={0}
                      required
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Per">
                  <Select
                    value={incomeFrequency}
                    onChange={(e) => setIncomeFrequency(e.target.value as Frequency)}
                  >
                    <option value="daily">Day</option>
                    <option value="monthly">Month</option>
                    <option value="yearly">Year</option>
                  </Select>
                </Field>
              </div>

              <BudgetFields
                value={budget}
                onChange={setBudget}
                monthlyIncomeRwf={monthlyIncome}
                onSuggest={() =>
                  Promise.resolve(suggestBudgetClient(monthlyIncome, budget.expectedPct))
                }
              />

              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={submitting}>
                  ← Back
                </Button>
                <Button type="submit" disabled={submitting || !budgetOk} className="flex-1">
                  {submitting ? 'Creating account…' : 'Create account'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
