/**
 * VUX - navigation icons and the mark, as inline SVG.
 *
 * Why SVG and not Unicode: status glyphs ([ok]    ) live in every core font
 * and are safe as text, so they stay text and inherit your colour for free.
 * Navigation glyphs like    do not - a machine missing them renders an empty
 * box in your sidebar. These nine are drawn in the same geometry instead, so
 * they are guaranteed and their stroke weight matches the mark exactly.
 *
 * All of them use `currentColor`, so they take the tone class you put on the
 * parent (`vux-danger`, `vux-brand-tone`, ...) with no extra work.
 */
import type { ReactElement, SVGProps } from 'react';

export type VuxIconName =
  | 'home'
  | 'transactions'
  | 'goals'
  | 'analytics'
  | 'screentime'
  | 'approvals'
  | 'timetable'
  | 'settings'
  | 'signout';

/** Drawn on a 24x24 grid at 1.6 stroke - the mark's proportions, scaled down. */
const PATHS: Record<VuxIconName, ReactElement> = {
  home: (
    <>
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M6.2 9.6V20h11.6V9.6" />
    </>
  ),
  transactions: (
    <>
      <path d="M4 9h13.5" />
      <path d="M14.5 6 17.5 9l-3 3" />
      <path d="M20 15H6.5" />
      <path d="M9.5 12 6.5 15l3 3" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20h16" />
      <path d="M6.5 20v-5.5" />
      <path d="M11 20V7.5" />
      <path d="M15.5 20v-8.5" />
      <path d="M20 20v-12" />
    </>
  ),
  /* Echoes  - a square with the lower-left quadrant filled. */
  screentime: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h8v8H6a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" opacity="0.9" />
    </>
  ),
  /* Echoes  - two parties meeting in the middle. */
  approvals: (
    <>
      <path d="M5 5v14l6.2-7z" />
      <path d="M19 5v14l-6.2-7z" />
    </>
  ),
  timetable: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16" />
      <path d="M9 9v11" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
    </>
  ),
  signout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M13.5 12H21" />
      <path d="M18 8.5 21.5 12 18 15.5" />
    </>
  ),
};

export interface VuxIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: VuxIconName;
  /** Pixel size; the icon is square. Defaults to 20 - the sidebar size. */
  size?: number;
}

export function VuxIcon({ name, size = 20, ...rest }: VuxIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The VUX mark: an X built from a V (straight, sharp vertex) and an inverted U
 * (same weight, curved apex), inside a disc.
 *
 * Stroke weight goes UP as the mark gets smaller - 9 units at 40px and above,
 * 10 at 24, 11 at 16 - or the strokes close up and it reads as a blob in a
 * favicon. This is the one place the geometry is allowed to change.
 */
export function VuxMark({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  const stroke = size >= 40 ? 9 : size >= 24 ? 10 : 11;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" {...rest}>
      <circle cx="50" cy="50" r="50" fill="var(--vux-mark-disc)" />
      <path
        d="M27 24 L50 55 L73 24"
        fill="none"
        stroke="var(--vux-mark-cut)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 79 C27 47, 73 47, 73 79"
        fill="none"
        stroke="var(--vux-mark-cut)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The credit line. Footer of every page, foot of every rail. */
export function VuxCredit({ className = '' }: { className?: string }) {
  return (
    <span className={`vux-credit ${className}`}>
      <VuxMark size={13} />
      Made by Vux
    </span>
  );
}
