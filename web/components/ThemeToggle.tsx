'use client';

import { useTheme, type Theme } from '@/lib/theme';

/**
 * Glyphs, not emoji - emoji are drawn by the operating system, so  and  are
 * a different picture on every platform and cannot take your colour.
 *
 * The three read as one idea: an empty disc is light, a filled disc is dark, and
 * the half disc follows whatever the machine is doing.
 */
const OPTIONS: { value: Theme; label: string; glyph: string }[] = [
  { value: 'light', label: 'Light', glyph: '○' },
  { value: 'dark', label: 'Dark', glyph: '●' },
  { value: 'system', label: 'System', glyph: '◐' },
];

/** Three-way Light / Dark / System theme switch. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-1 rounded border border-hairline bg-surface p-1 ${className}`}
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
            className={`vux-label inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 transition-hover ease-vux ${
              active ? 'text-brand' : 'text-muted hover:text-ink'
            }`}
            style={active ? { background: 'color-mix(in srgb, var(--vux-brand) 12%, transparent)' } : undefined}
          >
            <span aria-hidden className="text-sm leading-none">
              {opt.glyph}
            </span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
