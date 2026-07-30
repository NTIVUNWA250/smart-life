'use client';

/**
 * VUX - the wash.
 *
 * Floods a surface with a state colour for a beat, then drains back. Two scopes:
 *
 *   page      the whole viewport. For events that change the user's situation:
 *             a payment refused, a session expiring, a limit reached.
 *   local     one card. For something that happened inside that component.
 *
 * Using the page wash for a failed field validation is shouting at a typo.
 *
 * The wash is decoration, never the message. It is skipped entirely under
 * `prefers-reduced-motion`, so the caller must always write the result
 * somewhere the user can read it.
 */
import { useCallback, useEffect, useRef } from 'react';

export type VuxTone = 'success' | 'attention' | 'danger' | 'info' | 'neutral';

const FILL: Record<VuxTone, string> = {
  success: 'var(--vux-success-fill)',
  attention: 'var(--vux-attention-fill)',
  danger: 'var(--vux-danger-fill)',
  info: 'var(--vux-info-fill)',
  neutral: 'var(--vux-neutral-fill)',
};

/** 18% is the house strength. 30% is the ceiling - past it, body text dims. */
const DEFAULT_ALPHA = 18;

function run(el: HTMLElement, tone: VuxTone, alpha: number) {
  el.style.setProperty(
    '--vux-wash-colour',
    `color-mix(in srgb, ${FILL[tone]} ${alpha}%, transparent)`,
  );
  el.removeAttribute('data-on');
  void el.offsetWidth; // force a reflow so the animation restarts on repeat calls
  el.setAttribute('data-on', 'true');
}

/**
 * Page-level wash. Mounts a single fixed overlay on first use and reuses it.
 *
 *   const wash = useVuxPageWash();
 *   wash('danger');   // payment refused
 */
export function useVuxPageWash() {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let el = document.querySelector<HTMLDivElement>('.vux-wash');
    if (!el) {
      el = document.createElement('div');
      el.className = 'vux-wash';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    elRef.current = el;
    const clear = () => el?.removeAttribute('data-on');
    el.addEventListener('animationend', clear);
    return () => el?.removeEventListener('animationend', clear);
  }, []);

  return useCallback((tone: VuxTone, alpha: number = DEFAULT_ALPHA) => {
    if (elRef.current) run(elRef.current, tone, alpha);
  }, []);
}

/**
 * Component-level wash. Put the ref on the element and give it `vux-wash-local`.
 *
 *   const { ref, wash } = useVuxLocalWash<HTMLDivElement>();
 *   <div ref={ref} className="vux-wash-local">...</div>
 */
export function useVuxLocalWash<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clear = () => el.removeAttribute('data-on');
    el.addEventListener('animationend', clear);
    return () => el.removeEventListener('animationend', clear);
  }, []);

  const wash = useCallback((tone: VuxTone, alpha: number = DEFAULT_ALPHA) => {
    if (ref.current) run(ref.current, tone, alpha);
  }, []);

  return { ref, wash };
}
