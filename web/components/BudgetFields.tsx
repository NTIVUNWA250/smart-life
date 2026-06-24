'use client';

import { useState } from 'react';
import { Alert, Button, Field, Input, Select } from './ui';
import { formatRwf } from '@/lib/format';
import {
  BUDGET_MODELS,
  CUSTOM_MODEL_ID,
  deriveBudget,
  findModel,
  validateBudget,
} from '@/lib/budget';
import type { BudgetSuggestion } from '@/lib/types';

export interface BudgetValue {
  budgetModel: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
}

/**
 * Budget model dropdown + the three editable percentages (with an expected-
 * expenses amount that auto-calculates its %), a live RWF preview (including any
 * unexpected income), validation, and an optional "Suggest rates" action.
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

  const error = validateBudget(value);
  const effectiveIncome = monthlyIncomeRwf + extraIncomeRwf;
  const d = deriveBudget(effectiveIncome, 'monthly', value);
  const selectable = BUDGET_MODELS.filter((m) => m.selectable);
  const reference = BUDGET_MODELS.filter((m) => !m.selectable);
  const expectedAmount = Math.round((monthlyIncomeRwf * value.expectedPct) / 100);

  function selectModel(id: string) {
    if (id === CUSTOM_MODEL_ID) {
      onChange({ ...value, budgetModel: CUSTOM_MODEL_ID });
      return;
    }
    const m = findModel(id);
    if (!m) return;
    onChange({
      budgetModel: id,
      expectedPct: m.expectedPct,
      unexpectedPct: m.unexpectedPct,
      savingsPct: m.savingsPct,
    });
  }

  function setPct(key: keyof Omit<BudgetValue, 'budgetModel'>, n: number) {
    onChange({ ...value, budgetModel: CUSTOM_MODEL_ID, [key]: n });
  }

  function setExpectedFromAmount(amount: number) {
    const pct = monthlyIncomeRwf > 0 ? Math.round((amount / monthlyIncomeRwf) * 100) : value.expectedPct;
    setPct('expectedPct', Math.max(0, Math.min(100, pct)));
  }

  async function runSuggest() {
    if (!onSuggest) return;
    setSuggesting(true);
    setSuggestionMsg(null);
    try {
      const s = await onSuggest();
      if (s) {
        onChange({
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

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Budget model">
            <Select disabled={disabled} value={value.budgetModel} onChange={(e) => selectModel(e.target.value)}>
              <optgroup label="Savings ≥ 30%">
                {selectable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.savingsPct}% savings
                  </option>
                ))}
              </optgroup>
              <option value={CUSTOM_MODEL_ID}>Custom…</option>
              <optgroup label="Below 30% floor (not selectable)">
                {reference.map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.name} — {m.savingsPct}% savings
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
        {onSuggest && (
          <Button type="button" variant="secondary" disabled={disabled || suggesting} onClick={() => void runSuggest()}>
            {suggesting ? '…' : '✨ Suggest'}
          </Button>
        )}
      </div>

      {suggestionMsg && <Alert tone="info">{suggestionMsg}</Alert>}

      <Field label="Expected expenses (amount/month — auto-calculates %)">
        <Input
          type="number"
          min={0}
          disabled={disabled}
          value={expectedAmount}
          onChange={(e) => setExpectedFromAmount(Number(e.target.value))}
        />
      </Field>

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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
        {extraIncomeRwf > 0 && (
          <Row label="Effective income (incl. unexpected)" value={formatRwf(effectiveIncome)} strong />
        )}
        <Row label="Expected expenses" value={formatRwf(d.expectedExpensesRwf)} />
        <Row label="Unexpected buffer" value={formatRwf(d.unexpectedRwf)} />
        <Row label="Spendable / month" value={formatRwf(d.spendingAllowanceRwf)} strong />
        <Row label="Savings / month" value={formatRwf(d.savingsRwf)} accent />
        <Row label="Auto savings goal / year" value={formatRwf(d.autoGoalTargetRwf)} />
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={
          accent
            ? 'font-semibold text-brand-700 dark:text-brand-300'
            : strong
              ? 'font-semibold text-slate-900 dark:text-slate-100'
              : 'font-medium text-slate-700 dark:text-slate-200'
        }
      >
        {value}
      </span>
    </div>
  );
}

/** True when the value passes the client-side guardrails. */
export function isBudgetValid(v: BudgetValue): boolean {
  return validateBudget(v) === null;
}
