'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatRwf } from '@/lib/format';
import type { Frequency, FinanceResponse, Goal } from '@/lib/types';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <ProfileSection />
          <PasswordSection />
        </div>
        <SavingsPlanSection />
        <GoalsSection />
      </div>
    </AppShell>
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

const FREQ: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
];

function SavingsPlanSection() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [income, setIncome] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>('monthly');
  const [expenses, setExpenses] = useState('');
  const [expenseFrequency, setExpenseFrequency] = useState<Frequency>('monthly');
  const [savingsRatePct, setSavingsRatePct] = useState(50);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.finance.get();
      setData(res);
      if (res.profile) {
        setIncome(String(res.profile.incomeRwf));
        setIncomeFrequency(res.profile.incomeFrequency);
        setExpenses(String(res.profile.expensesRwf));
        setExpenseFrequency(res.profile.expenseFrequency);
        setSavingsRatePct(res.profile.savingsRatePct);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await api.finance.save({
        incomeRwf: Number(income),
        incomeFrequency,
        expensesRwf: Number(expenses) || 0,
        expenseFrequency,
        savingsRatePct,
      });
      setData(res);
      setMsg('Savings plan saved. Your spending limit and auto goal were updated.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Card title="Savings plan & limit"><Spinner /></Card>;

  const canEdit = data?.canEditNow ?? true;

  return (
    <Card title="Savings plan & limit">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Your income and expenses drive the auto-calculated savings goal and your monthly spending
        limit. Editable once a month.
      </p>
      {data?.derived && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Monthly income" value={formatRwf(data.derived.monthlyIncomeRwf)} />
          <Stat label="Monthly expenses" value={formatRwf(data.derived.monthlyExpensesRwf)} />
          <Stat label="Surplus" value={formatRwf(data.derived.monthlySurplusRwf)} />
          <Stat label="Auto savings / mo" value={formatRwf(data.derived.monthlySavingsRwf)} />
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert tone="error">{err}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        {!canEdit && (
          <Alert tone="warning">
            You already edited your plan this month. You can change it again next month.
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Income">
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
                {FREQ.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Expenses">
                <Input
                  type="number"
                  min={0}
                  disabled={!canEdit}
                  value={expenses}
                  onChange={(e) => setExpenses(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Per">
              <Select
                disabled={!canEdit}
                value={expenseFrequency}
                onChange={(e) => setExpenseFrequency(e.target.value as Frequency)}
              >
                {FREQ.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <Field label={`Save ${savingsRatePct}% of monthly surplus`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={!canEdit}
            value={savingsRatePct}
            onChange={(e) => setSavingsRatePct(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </Field>
        <Button type="submit" disabled={busy || !canEdit}>
          {busy ? 'Saving…' : 'Save plan'}
        </Button>
      </form>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
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

  if (loading) return <Card title="Goals"><Spinner /></Card>;

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
    goal.lastEditedAt && new Date(goal.lastEditedAt).getUTCMonth() === new Date().getUTCMonth() &&
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
          deadline !== goal.deadline.slice(0, 10)
            ? new Date(deadline).toISOString()
            : undefined,
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
      {msg && <div className="mt-2"><Alert tone="success">{msg}</Alert></div>}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          {err && <Alert tone="error">{err}</Alert>}
          {editedThisMonth && (
            <Alert tone="warning">This goal was already edited this month.</Alert>
          )}
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
