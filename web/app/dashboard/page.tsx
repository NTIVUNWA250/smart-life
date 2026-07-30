'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  ProgressBar,
  Select,
  Spinner,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { appLabel, BLOCKABLE_APPS } from '@/lib/apps';
import { useVuxPageWash } from '@/components/vux/useVuxWash';
import { errorMessage } from '@/lib/errors';
import { clampPct, formatDate, formatMinutes, formatRwf } from '@/lib/format';
import type {
  AnalyticsSummary,
  DailyStatus,
  Goal,
  ScreenTimePolicy,
  Transaction,
  TransactionType,
} from '@/lib/types';

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [policies, setPolicies] = useState<ScreenTimePolicy[]>([]);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, t, g, p, lim] = await Promise.all([
        api.analytics.summary(),
        api.transactions.list({ limit: 8 }),
        api.goals.list(),
        api.screentime.policies(),
        api.limits.current(),
      ]);
      setSummary(s);
      setTransactions(t.items);
      setGoals(g.items);
      setPolicies(p.items);
      setDaily(lim.daily);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-6">
      {daily && <DailyBudgetCard daily={daily} />}
      {summary && <SummaryCards summary={summary} />}

      <div className="grid gap-6 md:grid-cols-2">
        <AddTransaction onDone={load} />
        <AddGoal onDone={load} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GoalsList goals={goals} onDone={load} />
        <RecentTransactions transactions={transactions} />
      </div>

      <ScreenTime policies={policies} onDone={load} />
    </div>
  );
}

function DailyBudgetCard({ daily }: { daily: DailyStatus }) {
  const { budget, allowanceRwf, spentTodayRwf, remainingRwf } = daily;
  const usedPct = allowanceRwf > 0 ? (spentTodayRwf / allowanceRwf) * 100 : 0;
  // At exactly the allowance every further expense is already refused, so this
  // matches the server's block condition rather than trailing it by one franc.
  const over = spentTodayRwf >= allowanceRwf;
  // Derived from the server's own numbers — the browser clock may disagree, and
  // this card is only fetched on mount so it can outlive a UTC midnight.
  const isHeavyDay = allowanceRwf > budget.todayLimitRwf;

  return (
    <Card title="Today's budget">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold text-ink">
            {formatRwf(remainingRwf)}
          </div>
          <div className="mt-1 text-sm text-muted">
            left of {formatRwf(allowanceRwf)} for today
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={budget.todayIsWeekend ? 'green' : 'blue'}>
            {budget.todayIsWeekend ? 'Weekend' : 'Weekday'} rate
          </Badge>
          {isHeavyDay && budget.heavyExpenseRwf > 0 && (
            <Badge tone="amber">+{formatRwf(budget.heavyExpenseRwf)} rent day</Badge>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={clampPct(usedPct)} tone={over ? 'danger' : 'brand'} />
      </div>
      <div className="mt-1 text-sm text-muted">
        {formatRwf(spentTodayRwf)} spent today
      </div>

      {over && (
        <div className="mt-3">
          <Alert tone="warning">
            You are over today&apos;s budget. Further spending is blocked until tomorrow —
            request a peer approval if you need an override.
          </Alert>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted sm:grid-cols-3">
        <div>
          Weekdays <span className="font-medium text-ink">{formatRwf(budget.weekdayLimitRwf)}</span>/day
        </div>
        <div>
          Weekends <span className="font-medium text-ink">{formatRwf(budget.weekendLimitRwf)}</span>/day
        </div>
        {budget.heavyExpenseRwf > 0 && (
          <div>
            Rent <span className="font-medium text-ink">{formatRwf(budget.heavyExpenseRwf)}</span> on day {budget.heavyExpenseDay}
          </div>
        )}
      </div>
    </Card>
  );
}

function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const { finance, savings, time } = summary;
  const spentPct = finance.limitRwf > 0 ? (finance.spentRwf / finance.limitRwf) * 100 : 0;
  const timePct = time.totalLimitMin > 0 ? (time.totalUsedMin / time.totalLimitMin) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card title="Spending this month">
        <div className="text-2xl font-bold text-ink">
          {formatRwf(finance.spentRwf)}
        </div>
        <div className="mt-1 text-sm text-muted">
          of {formatRwf(finance.limitRwf)} limit
        </div>
        <div className="mt-3">
          <ProgressBar value={spentPct} tone={finance.isBlocked ? 'danger' : 'brand'} />
        </div>
        {finance.isBlocked && (
          <div className="mt-3">
            <Alert tone="warning">
              Spending is <strong>blocked</strong> — you have reached your limit.
              Request a peer/parent approval to unblock.
            </Alert>
          </div>
        )}
      </Card>

      <Card title="Savings goals">
        <div className="text-2xl font-bold text-ink">
          {formatRwf(savings.savedRwf)}
        </div>
        <div className="mt-1 text-sm text-muted">
          of {formatRwf(savings.targetRwf)} ({savings.progressPct}%)
        </div>
        <div className="mt-3">
          <ProgressBar value={savings.progressPct} tone="success" />
        </div>
        <div className="mt-3 flex gap-2">
          <Badge tone="blue">{savings.activeGoals} active</Badge>
          <Badge tone="green">{savings.achievedGoals} achieved</Badge>
        </div>
      </Card>

      <Card title="Screen time today">
        <div className="text-2xl font-bold text-ink">
          {formatMinutes(time.totalUsedMin)}
        </div>
        <div className="mt-1 text-sm text-muted">
          of {formatMinutes(time.totalLimitMin)} allowed
        </div>
        <div className="mt-3">
          <ProgressBar value={timePct} tone={time.blocked.length ? 'danger' : 'brand'} />
        </div>
        {time.blocked.length > 0 && (
          <div className="mt-3 text-xs text-muted">
            Blocked: {time.blocked.join(', ')}
          </div>
        )}
      </Card>
    </div>
  );
}

function AddTransaction({ onDone }: { onDone: () => Promise<void> }) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wash = useVuxPageWash();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBlocked(null);
    setBusy(true);
    try {
      await api.transactions.create({
        type,
        amountRwf: Number(amount),
        category: category || undefined,
        note: note || undefined,
      });
      setAmount('');
      setCategory('');
      setNote('');
      wash('success');
      await onDone();
    } catch (err) {
      // FR4: the server refuses expenses that breach the daily/monthly limit.
      // That is an expected outcome with its own explanation, not a failure.
      if (err instanceof ApiError && err.status === 409) {
        setBlocked(err.message);
        // The refusal is the one event worth washing the whole screen for: it
        // changes what the user can do next. The alert below carries the actual
        // message — the wash is skipped under prefers-reduced-motion.
        wash('danger');
      } else {
        setError(errorMessage(err));
        wash('danger');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add income / expense">
      <form onSubmit={submit} className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {blocked && (
          <Alert tone="warning">
            {blocked} Ask a peer or parent to approve an override if you need this expense.
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Amount (RWF)">
            <Input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Category">
          <Input
            placeholder="food, transport…"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Add transaction'}
        </Button>
      </form>
    </Card>
  );
}

function AddGoal({ onDone }: { onDone: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.goals.create({
        title,
        targetRwf: Number(target),
        deadline: new Date(deadline).toISOString(),
      });
      setTitle('');
      setTarget('');
      setDeadline('');
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Create a savings goal">
      <form onSubmit={submit} className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Title">
          <Input
            required
            placeholder="Laptop fund"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (RWF)">
            <Input
              type="number"
              min={1}
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Deadline">
            <Input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Create goal'}
        </Button>
      </form>
    </Card>
  );
}

function GoalsList({ goals, onDone }: { goals: Goal[]; onDone: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addSaved(goal: Goal) {
    const input = window.prompt(`Add savings to "${goal.title}" (RWF):`);
    if (!input) return;
    const addSavedRwf = Number(input);
    if (!Number.isInteger(addSavedRwf) || addSavedRwf <= 0) return;
    setBusyId(goal.id);
    try {
      await api.goals.update(goal.id, { addSavedRwf });
      await onDone();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title="Your goals">
      {goals.length === 0 ? (
        <p className="text-sm text-muted">No goals yet — create one to start saving.</p>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">
                  {g.title}
                  {g.isAuto && <span className="ml-2"><Badge tone="blue">auto</Badge></span>}
                </span>
                <Badge tone={g.status === 'achieved' ? 'green' : 'slate'}>{g.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted">
                {formatRwf(g.savedRwf)} / {formatRwf(g.targetRwf)} · due {formatDate(g.deadline)}
              </div>
              <div className="mt-2">
                <ProgressBar
                  value={clampPct((g.savedRwf / g.targetRwf) * 100)}
                  tone="success"
                />
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={busyId === g.id || g.status === 'achieved'}
                  onClick={() => void addSaved(g)}
                >
                  Add savings
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card title="Recent transactions">
      {transactions.length === 0 ? (
        <p className="text-sm text-muted">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-ink">
                  {t.category}
                  {t.note ? ` · ${t.note}` : ''}
                </div>
                <div className="text-xs text-muted">{formatDate(t.occurredAt)}</div>
              </div>
              <span
                className={
                  t.type === 'income'
                    ? 'text-sm font-semibold text-state-success'
                    : 'text-sm font-semibold text-state-danger'
                }
              >
                {t.type === 'income' ? '+' : '−'}
                {formatRwf(t.amountRwf)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScreenTime({
  policies,
  onDone,
}: {
  policies: ScreenTimePolicy[];
  onDone: () => Promise<void>;
}) {
  const [appId, setAppId] = useState(BLOCKABLE_APPS[0].id);
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.screentime.upsertPolicy({
        appOrSite: appId,
        dailyLimitMin: Number(limit),
        kind: 'app',
        label: BLOCKABLE_APPS.find((a) => a.id === appId)?.label,
      });
      setLimit('');
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  // A limit is set here but measured on the phone: Android reports per-app
  // foreground time through UsageStatsManager, and the browser has no equivalent.
  // Saying so is better than showing 0m forever and looking broken.
  const unmeasurable = policies.filter((p) => p.kind === 'url');

  return (
    <Card title="Screen-time limits">
      <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="App">
          <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
            {BLOCKABLE_APPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Daily limit (min)">
          <Input
            type="number"
            min={0}
            max={1440}
            required
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Set limit'}
        </Button>
      </form>
      <p className="mb-4 text-xs text-muted">
        Time is measured by the SMART LIFE app on your Android phone, so a limit set here
        stays at 0m until you sign in there and grant usage access.
      </p>
      {policies.length === 0 ? (
        <p className="text-sm text-muted">No screen-time limits set.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-ink">
                {appLabel(p.appOrSite, p.label)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {formatMinutes(p.usedMin)} / {formatMinutes(p.dailyLimitMin)}
                </span>
                {p.kind === 'url' && <Badge tone="amber">not measured</Badge>}
                {p.isBlocked && <Badge tone="red">blocked</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {unmeasurable.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Website limits can&apos;t be measured — the phone sees which app is open, not
          which page a browser is on. Set a limit on the app instead.
        </p>
      )}
    </Card>
  );
}
