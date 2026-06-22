'use client';

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { clampPct } from '@/lib/format';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const styles: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-500/30 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-500/30 ${props.className ?? ''}`}
    />
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
}: {
  value: number;
  tone?: 'brand' | 'danger' | 'success';
}) {
  const pct = clampPct(value);
  const colors: Record<typeof tone, string> = {
    brand: 'bg-brand-500',
    danger: 'bg-red-500',
    success: 'bg-emerald-500',
  };
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-all ${colors[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'warning' | 'info' | 'success';
  children: ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
    info: 'border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const styles: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    blue: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {label ?? 'Loading…'}
    </div>
  );
}
