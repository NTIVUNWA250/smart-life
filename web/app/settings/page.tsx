'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { BudgetFields, isBudgetValid, type BudgetValue } from '@/components/BudgetFields';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatRwf } from '@/lib/format';
import { findModel, toMonthly, DEFAULT_MODEL_ID, DEFAULT_WEEKEND_BOOST_PCT } from '@/lib/budget';
import type { Frequency, FinanceResponse, Goal } from '@/lib/types';

const DEFAULT_BUDGET: BudgetValue = (() => {
  const m = findModel(DEFAULT_MODEL_ID)!;
  return {
    budgetModel: m.id,
    expectedPct: m.expectedPct,
    unexpectedPct: m.unexpectedPct,
    savingsPct: m.savingsPct,
    expenseFrequency: 'monthly',
    heavyExpenseRwf: 0,
    heavyExpenseDay: 1,
    weekendBoostPct: DEFAULT_WEEKEND_BOOST_PCT,
  };
})();

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <ProfileSection />
          <PasswordSection />
        </div>
        <BudgetSection />
        <GoalsSection />
        <AppearanceSection />
      </div>
    </AppShell>
  );
}

function AppearanceSection() {
  const { logout } = useAuth();
  return (
    <Card title="Appearance & account">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Theme</p>
          <ThemeToggle />
        </div>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button variant="danger" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const { user: updated } = await api.auth.updateProfile({ name, email });
      setUser(updated);
      setMsg('Profile updated.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Profile">
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert tone="error">{err}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        <Field label="Name">
          <Input value={name} minLength={2} required onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      await api.auth.changePassword(current, next);
      setCurrent('');
      setNext('');
      setMsg('Password changed. Other sessions were signed out.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password">
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert tone="error">{err}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Updating…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}

function BudgetSection() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [income, setIncome] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>('monthly');
  const [budget, setBudget] = useState<BudgetValue>(DEFAULT_BUDGET);
  const [unexpectedIncome, setUnexpectedIncome] = useState('0');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [incomeBusy, setIncomeBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [res, lim] = await Promise.all([api.finance.get(), api.limits.current()]);
      setData(res);
      setUnexpectedIncome(String(lim.limit.unexpectedIncomeRwf));
      if (res.profile) {
        setIncome(String(res.profile.incomeRwf));
        setIncomeFrequency(res.profile.incomeFrequency);
        setBudget({
          budgetModel: res.profile.budgetModel,
          expectedPct: res.profile.expectedPct,
          unexpectedPct: res.profile.unexpectedPct,
          savingsPct: res.profile.savingsPct,
          expenseFrequency: res.profile.expenseFrequency,
          heavyExpenseRwf: res.profile.heavyExpenseRwf,
          heavyExpenseDay: res.profile.heavyExpenseDay,
          weekendBoostPct: res.profile.weekendBoostPct,
        });
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveUnexpectedIncome() {
    setIncomeBusy(true);
    setErr(null);
    try {
      await api.limits.setUnexpectedIncome(Number(unexpectedIncome) || 0);
      setMsg('Unexpected income recorded for this month.');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setIncomeBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyIncome = useMemo(
    () => toMonthly(Number(income) || 0, incomeFrequency),
    [income, incomeFrequency],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await api.finance.save({
        incomeRwf: Number(income),
        incomeFrequency,
        budgetModel: budget.budgetModel,
        expectedPct: budget.expectedPct,
        unexpectedPct: budget.unexpectedPct,
        savingsPct: budget.savingsPct,
        expenseFrequency: budget.expenseFrequency,
        heavyExpenseRwf: budget.heavyExpenseRwf,
        heavyExpenseDay: budget.heavyExpenseDay,
        weekendBoostPct: budget.weekendBoostPct,
      });
      setData(res);
      setMsg('Budget saved. Your spending limit and auto goal were updated.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card title="Budget & spending limit">
        <Spinner />
      </Card>
    );
  }

  const canEdit = data?.canEditNow ?? true;

  return (
    <Card title="Budget & spending limit">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Your income and budget model set the auto savings goal and your monthly spending limit
        (income − the savings you reserve). Savings stays ≥ 30%. Editable once a month.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert tone="error">{err}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        {!canEdit && (
          <Alert tone="warning">
            You already edited your budget this month. You can change it again next month.
          </Alert>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Full income">
              <Input
                type="number"
                min={0}
                required
                disabled={!canEdit}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Per">
            <Select
              disabled={!canEdit}
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
          extraIncomeRwf={Number(unexpectedIncome) || 0}
          disabled={!canEdit}
          onSuggest={async () => {
            const { suggestion } = await api.finance.suggest({
              incomeRwf: Number(income) || 0,
              incomeFrequency,
              expectedPct: budget.expectedPct,
            });
            return suggestion;
          }}
        />

        <Button type="submit" disabled={busy || !canEdit || !isBudgetValid(budget, monthlyIncome)}>
          {busy ? 'Saving…' : 'Save budget'}
        </Button>
      </form>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Unexpected income this month
        </p>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Got extra money this month? Add it to raise this month&apos;s spendable limit and savings.
          It doesn&apos;t change your saved budget.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Amount (RWF)">
              <Input
                type="number"
                min={0}
                value={unexpectedIncome}
                onChange={(e) => setUnexpectedIncome(e.target.value)}
              />
            </Field>
          </div>
          <Button type="button" variant="secondary" disabled={incomeBusy} onClick={() => void saveUnexpectedIncome()}>
            {incomeBusy ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function GoalsSection() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api.goals.list();
      setGoals(items);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <Card title="Goals">
        <Spinner />
      </Card>
    );

  return (
    <Card title="Goals">
      {err && <Alert tone="error">{err}</Alert>}
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Editing a goal&apos;s title, target or deadline needs approval (a parent for minors, a peer
        for adults) and is allowed once a month.
      </p>
      {goals.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No goals yet.</p>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <GoalEditRow key={g.id} goal={g} onDone={load} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function GoalEditRow({ goal, onDone }: { goal: Goal; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(String(goal.targetRwf));
  const [deadline, setDeadline] = useState(goal.deadline.slice(0, 10));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editedThisMonth =
    goal.lastEditedAt &&
    new Date(goal.lastEditedAt).getUTCMonth() === new Date().getUTCMonth() &&
    new Date(goal.lastEditedAt).getUTCFullYear() === new Date().getUTCFullYear();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      await api.goals.editRequest(goal.id, {
        title: title !== goal.title ? title : undefined,
        targetRwf: Number(target) !== goal.targetRwf ? Number(target) : undefined,
        deadline:
          deadline !== goal.deadline.slice(0, 10) ? new Date(deadline).toISOString() : undefined,
        reason: reason || undefined,
      });
      setMsg('Edit requested — awaiting approval.');
      setOpen(false);
      await onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-100">{goal.title}</span>
          {goal.isAuto && <span className="ml-2"><Badge tone="blue">auto</Badge></span>}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {formatRwf(goal.targetRwf)} · due {formatDate(goal.deadline)}
          </div>
        </div>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'Request edit'}
        </Button>
      </div>
      {msg && (
        <div className="mt-2">
          <Alert tone="success">{msg}</Alert>
        </div>
      )}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          {err && <Alert tone="error">{err}</Alert>}
          {editedThisMonth && <Alert tone="warning">This goal was already edited this month.</Alert>}
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target (RWF)">
              <Input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Deadline">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
          <Field label="Reason for approver (optional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Requesting…' : 'Submit for approval'}
          </Button>
        </form>
      )}
    </li>
  );
}
