'use client';

import { useState } from 'react';
import { Alert, Button, Field, Input, Select } from './ui';
import { formatRwf } from '@/lib/format';
import {
  BUDGET_MODELS,
  CUSTOM_MODEL_ID,
  deriveBudget,
  deriveDailyPreview,
  findModel,
  fromMonthly,
  toMonthly,
  validateBudget,
} from '@/lib/budget';
import type { BudgetSuggestion, Frequency } from '@/lib/types';

export interface BudgetValue {
  budgetModel: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
  expenseFrequency: Frequency;
  /** Lump monthly expense (rent), paid on heavyExpenseDay and exempt from the daily limit. */
  heavyExpenseRwf: number;
  heavyExpenseDay: number;
  weekendBoostPct: number;
}

/**
 * The percentage track is primary: a budget-model dropdown, a  Suggest action,
 * and the three editable percentages (expected / unexpected / savings) with a live
 * RWF preview. Below it, an optional expense **fit check** lets the user state
 * their real expected expenses (in any cadence) to see whether they fit the
 * budgeted ratios - it never rewrites the percentages unless they explicitly apply.
 */
export function BudgetFields({
  value,
  onChange,
  monthlyIncomeRwf,
  extraIncomeRwf = 0,
  disabled = false,
  onSuggest,
}: {
  value: BudgetValue;
  onChange: (v: BudgetValue) => void;
  monthlyIncomeRwf: number;
  extraIncomeRwf?: number;
  disabled?: boolean;
  onSuggest?: () => Promise<BudgetSuggestion | null>;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionMsg, setSuggestionMsg] = useState<string | null>(null);
  // Local-only "what do my real expenses cost?" check - not part of the budget.
  const [statedExpense, setStatedExpense] = useState('');

  const error = validateBudget(value);
  const effectiveIncome = monthlyIncomeRwf + extraIncomeRwf;
  const d = deriveBudget(effectiveIncome, 'monthly', value);
  // The daily budget is derived from the saved profile only - the server's
  // deriveDaily never sees this month's unexpected income - so preview it from
  // base income, or we would promise a daily limit the server won't honour.
  const base = deriveBudget(monthlyIncomeRwf, 'monthly', value);
  const daily = deriveDailyPreview(base, value.heavyExpenseRwf, value.weekendBoostPct);
  const heavyTooBig = value.heavyExpenseRwf > base.expectedExpensesRwf;
  const selectable = BUDGET_MODELS.filter((m) => m.selectable);
  const reference = BUDGET_MODELS.filter((m) => !m.selectable);
  const budgetedExpenseAmount = fromMonthly(
    Math.round((monthlyIncomeRwf * value.expectedPct) / 100),
    value.expenseFrequency,
  );

  function selectModel(id: string) {
    if (id === CUSTOM_MODEL_ID) {
      onChange({ ...value, budgetModel: CUSTOM_MODEL_ID });
      return;
    }
    const m = findModel(id);
    if (!m) return;
    onChange({
      ...value,
      budgetModel: id,
      expectedPct: m.expectedPct,
      unexpectedPct: m.unexpectedPct,
      savingsPct: m.savingsPct,
    });
  }

  function setPct(key: 'expectedPct' | 'unexpectedPct' | 'savingsPct', n: number) {
    onChange({ ...value, budgetModel: CUSTOM_MODEL_ID, [key]: n });
  }

  async function runSuggest() {
    if (!onSuggest) return;
    setSuggesting(true);
    setSuggestionMsg(null);
    try {
      const s = await onSuggest();
      if (s) {
        onChange({
          ...value,
          budgetModel: CUSTOM_MODEL_ID,
          expectedPct: s.expectedPct,
          unexpectedPct: s.unexpectedPct,
          savingsPct: s.savingsPct,
        });
        setSuggestionMsg(s.rationale);
      }
    } finally {
      setSuggesting(false);
    }
  }

  // -- expense fit check --
  const statedMonthly =
    statedExpense !== '' ? toMonthly(Number(statedExpense), value.expenseFrequency) : null;
  const statedPct =
    statedMonthly != null && monthlyIncomeRwf > 0
      ? Math.round((statedMonthly / monthlyIncomeRwf) * 100)
      : null;
  const totalExpensesPct = value.expectedPct + value.unexpectedPct;

  let fit: { tone: 'success' | 'info' | 'warning'; msg: string } | null = null;
  if (statedPct != null) {
    if (statedPct <= value.expectedPct) {
      fit = { tone: 'success', msg: `✓ ≈ ${statedPct}% of income - fits within your ${value.expectedPct}% expenses budget.` };
    } else if (statedPct <= totalExpensesPct) {
      fit = {
        tone: 'info',
        msg: `≈ ${statedPct}% - above planned ${value.expectedPct}%, but within total expenses ${totalExpensesPct}% (dips into your unexpected buffer).`,
      };
    } else {
      fit = {
        tone: 'warning',
        msg: `△ ≈ ${statedPct}% - exceeds your ${totalExpensesPct}% total-expenses budget. Raise your expenses % or trim spending.`,
      };
    }
  }

  return (
    <div className="space-y-3">
      {/* --- Percentage track (primary) --- */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Budget model">
            <Select disabled={disabled} value={value.budgetModel} onChange={(e) => selectModel(e.target.value)}>
              <optgroup label="Savings ≥ 30%">
                {selectable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {m.savingsPct}% savings
                  </option>
                ))}
              </optgroup>
              <option value={CUSTOM_MODEL_ID}>Custom…</option>
              <optgroup label="Below 30% floor (not selectable)">
                {reference.map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.name} - {m.savingsPct}% savings
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
        {onSuggest && (
          <Button type="button" variant="secondary" disabled={disabled || suggesting} onClick={() => void runSuggest()}>
            {suggesting ? '…' : '✦ Suggest'}
          </Button>
        )}
      </div>

      {suggestionMsg && <Alert tone="info">{suggestionMsg}</Alert>}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Expenses %">
          <Input
            type="number"
            min={0}
            max={70}
            disabled={disabled}
            value={value.expectedPct}
            onChange={(e) => setPct('expectedPct', Number(e.target.value))}
          />
        </Field>
        <Field label="Unexpected %">
          <Input
            type="number"
            min={0}
            max={70}
            disabled={disabled}
            value={value.unexpectedPct}
            onChange={(e) => setPct('unexpectedPct', Number(e.target.value))}
          />
        </Field>
        <Field label="Savings %">
          <Input
            type="number"
            min={30}
            max={100}
            disabled={disabled}
            value={value.savingsPct}
            onChange={(e) => setPct('savingsPct', Number(e.target.value))}
          />
        </Field>
      </div>

      {error && <Alert tone="warning">{error}</Alert>}

      <div className="rounded border border-hairline bg-paper p-3 text-sm">
        {extraIncomeRwf > 0 && (
          <Row label="Effective income (incl. unexpected)" value={formatRwf(effectiveIncome)} strong />
        )}
        <Row label="Expected expenses" value={formatRwf(d.expectedExpensesRwf)} />
        <Row label="Unexpected buffer" value={formatRwf(d.unexpectedRwf)} />
        <Row label="Spendable / month" value={formatRwf(d.spendingAllowanceRwf)} strong />
        <Row label="Savings / month" value={formatRwf(d.savingsRwf)} accent />
        <Row label="Auto savings goal / year" value={formatRwf(d.autoGoalTargetRwf)} />
      </div>

      {/* --- Daily spending budget --- */}
      <div className="rounded border border-hairline p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Daily spending budget
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Big monthly expense">
            <Input
              type="number"
              min={0}
              disabled={disabled}
              placeholder="e.g. rent"
              value={value.heavyExpenseRwf}
              onChange={(e) => onChange({ ...value, heavyExpenseRwf: Number(e.target.value) })}
            />
          </Field>
          <Field label="Paid on day">
            <Input
              type="number"
              min={1}
              max={28}
              disabled={disabled}
              value={value.heavyExpenseDay}
              onChange={(e) => onChange({ ...value, heavyExpenseDay: Number(e.target.value) })}
            />
          </Field>
          <Field label="Weekend boost %">
            <Input
              type="number"
              min={0}
              max={100}
              disabled={disabled}
              value={value.weekendBoostPct}
              onChange={(e) => onChange({ ...value, weekendBoostPct: Number(e.target.value) })}
            />
          </Field>
        </div>

        {heavyTooBig ? (
          <Alert tone="warning">
            Your big monthly expense exceeds your {formatRwf(d.expectedExpensesRwf)} expenses budget.
          </Alert>
        ) : (
          <div className="mt-2 rounded border border-hairline bg-paper p-3 text-sm">
            <Row label="Rent-style lump (exempt)" value={formatRwf(daily.heavyExpenseRwf)} />
            <Row label="Spread across the month" value={formatRwf(daily.distributableRwf)} />
            <Row label="Weekday limit / day" value={formatRwf(daily.weekdayLimitRwf)} strong />
            <Row label="Weekend limit / day" value={formatRwf(daily.weekendLimitRwf)} accent />
          </div>
        )}
      </div>

      {/* --- Expense fit check (secondary; doesn't change the budget) --- */}
      <div className="rounded border border-dashed border-hairline p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Check your real expenses
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Your expected expenses">
              <Input
                type="number"
                min={0}
                disabled={disabled}
                placeholder={`e.g. ${budgetedExpenseAmount}`}
                value={statedExpense}
                onChange={(e) => setStatedExpense(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Per">
            <Select
              disabled={disabled}
              value={value.expenseFrequency}
              onChange={(e) => onChange({ ...value, expenseFrequency: e.target.value as Frequency })}
            >
              <option value="daily">Day</option>
              <option value="monthly">Month</option>
              <option value="yearly">Year</option>
            </Select>
          </Field>
        </div>
        {fit && (
          <div className="mt-2 space-y-2">
            <Alert tone={fit.tone}>{fit.msg}</Alert>
            {statedPct != null && statedPct !== value.expectedPct && statedPct <= 70 && !disabled && (
              <Button type="button" variant="secondary" onClick={() => setPct('expectedPct', statedPct)}>
                Apply {statedPct}% as my expenses rate
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span
        className={
          accent
            ? 'font-semibold text-brand'
            : strong
              ? 'font-semibold text-ink'
              : 'font-medium text-ink'
        }
      >
        {value}
      </span>
    </div>
  );
}

/** True when the value passes the client-side guardrails (mirrors the server rules). */
export function isBudgetValid(v: BudgetValue, monthlyIncomeRwf = 0): boolean {
  if (validateBudget(v) !== null) return false;
  if (!Number.isInteger(v.heavyExpenseDay) || v.heavyExpenseDay < 1 || v.heavyExpenseDay > 28) {
    return false;
  }
  if (!Number.isInteger(v.weekendBoostPct) || v.weekendBoostPct < 0 || v.weekendBoostPct > 100) {
    return false;
  }
  if (v.heavyExpenseRwf < 0) return false;
  const expected = Math.round((monthlyIncomeRwf * v.expectedPct) / 100);
  return v.heavyExpenseRwf <= expected;
}
