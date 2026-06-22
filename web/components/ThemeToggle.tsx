'use client';

import { useTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

/** Three-way Light / Dark / System theme switch. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              active
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <span aria-hidden>{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
