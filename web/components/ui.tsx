'use client';

/**
 * SMART LIFE UI primitives, wearing VUX.
 *
 * The exported API is unchanged, so no page needed editing - the retrofit
 * happens here and propagates. Colour now comes from `design-system/vux.css`
 * custom properties rather than hard-coded Tailwind palette steps, which is
 * what lets a single `data-product` on <html> re-skin the whole app.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { clampPct } from '@/lib/format';

/* Hairlines, not shadows: depth comes from the surface tint, which the ground
   formula supplies in both themes. */
export function Card({
  title,
  children,
  className = '',
  id,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Anchor target, so another page can deep-link straight to this card. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded border border-hairline bg-surface p-5 ${className}`}
    >
      {title && <h2 className="vux-label mb-4">{title}</h2>}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` notches; everything else is a plain hairline. */
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
};

/**
 * One button, two border treatments. Notch is reserved for the action that
 * commits - one per screen. If two actions both look primary, neither is.
 *
 * The colour is the action's state, not decoration: a Deny wears danger so the
 * button says what it does before the label is read.
 */
export function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const tone: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'vux-brand-tone',
    secondary: 'vux-neutral',
    danger: 'vux-danger',
    success: 'vux-success',
  };
  const treatment = variant === 'primary' ? 'vux-btn--notch' : 'vux-btn--plain';
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`vux-btn ${treatment} ${tone[variant]} inline-flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

const CONTROL =
  'w-full rounded border border-hairline bg-surface px-3 py-2 text-xs text-ink outline-none transition-hover ease-vux focus:border-brand';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function ProgressBar({
  value,
  tone = 'brand',
}: {
  value: number;
  tone?: 'brand' | 'danger' | 'success';
}) {
  const pct = clampPct(value);
  const fill: Record<typeof tone, string> = {
    brand: 'var(--vux-brand)',
    danger: 'var(--vux-danger-fill)',
    success: 'var(--vux-success-fill)',
  };
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-sm"
      style={{ background: 'var(--vux-neutral-tint)' }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-hover ease-vux"
        style={{ width: `${pct}%`, background: fill[tone] }}
      />
    </div>
  );
}

/* Glyphs, not emoji: they are text, so they take the tone colour and render
   identically on every platform. */
const ALERT_GLYPH = {
  error: '✕',
  warning: '△',
  info: 'ⓘ',
  success: '✓',
  neutral: '⊗',
} as const;

const ALERT_TONE = {
  error: 'vux-danger',
  warning: 'vux-attention',
  info: 'vux-info',
  success: 'vux-success',
  neutral: 'vux-neutral',
} as const;

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: keyof typeof ALERT_TONE;
  children: ReactNode;
}) {
  return (
    <div
      className={`${ALERT_TONE[tone]} flex items-start gap-2.5 rounded border px-3.5 py-2.5 text-xs`}
      style={{
        background: 'var(--vux-tone-tint)',
        color: 'var(--vux-tone-text)',
        borderColor: 'color-mix(in srgb, var(--vux-tone-text) 28%, transparent)',
      }}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <span aria-hidden="true" className="mt-px text-base leading-none">
        {ALERT_GLYPH[tone]}
      </span>
      <span>{children}</span>
    </div>
  );
}

const BADGE_TONE = {
  slate: 'vux-neutral',
  green: 'vux-success',
  red: 'vux-danger',
  amber: 'vux-attention',
  blue: 'vux-info',
} as const;

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONE;
}) {
  return <span className={`vux-chip ${BADGE_TONE[tone]}`}>{children}</span>;
}

/** Loading wears the product's colour - the one state that should. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2"
        style={{
          borderColor: 'var(--vux-hairline)',
          borderTopColor: 'var(--vux-brand)',
        }}
      />
      {label ?? 'Loading…'}
    </div>
  );
}
