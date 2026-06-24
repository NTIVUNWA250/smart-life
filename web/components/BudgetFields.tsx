'use client';

import { Alert, Field, Input, Select } from './ui';
import { formatRwf } from '@/lib/format';
import {
  BUDGET_MODELS,
  CUSTOM_MODEL_ID,
  deriveBudget,
  findModel,
  validateBudget,
} from '@/lib/budget';

export interface BudgetValue {
  budgetModel: string;
  expectedPct: number;
  unexpectedPct: number;
  savingsPct: number;
}

/**
 * Budget model dropdown + the three editable percentages (expected / unexpected /
 * savings) with a live RWF preview. Editing a percentage switches to "Custom".
 * `monthlyIncomeRwf` is the already-normalised monthly income for the preview.
 */
export function BudgetFields({
  value,
  onChange,
  monthlyIncomeRwf,
  disabled = false,
}: {
  value: BudgetValue;
  onChange: (v: BudgetValue) => void;
  monthlyIncomeRwf: number;
  disabled?: boolean;
}) {
  const error = validateBudget(value);
  const d = deriveBudget(monthlyIncomeRwf, 'monthly', value);
  const selectable = BUDGET_MODELS.filter((m) => m.selectable);
  const reference = BUDGET_MODELS.filter((m) => !m.selectable);

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

  return (
    <div className="space-y-3">
      <Field label="Budget model">
        <Select
          disabled={disabled}
          value={value.budgetModel}
          onChange={(e) => selectModel(e.target.value)}
        >
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

      <div className="grid grid-cols-3 gap-3">
        <Field label="Expenses %">
          <Input
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={value.expectedPct}
            onChange={(e) => setPct('expectedPct', Number(e.target.value))}
          />
        </Field>
        <Field label="Unexpected %">
          <Input
            type="number"
            min={0}
            max={10}
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
