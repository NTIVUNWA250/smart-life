/**
 * VUX — Tailwind preset.
 *
 * Every value here points at a custom property defined in `vux.css`, so the
 * tokens have exactly one source of truth. Import vux.css first; this preset
 * only teaches Tailwind the names.
 *
 *   // tailwind.config.ts
 *   import vux from '../design-system/vux.preset.js';   // CommonJS, works either way
 *   export default { presets: [vux], content: [...] };
 *
 * Caveat worth knowing: because the tokens are whole colours rather than raw
 * channel triplets, Tailwind's slash-opacity syntax (`text-state-danger/50`)
 * will not work on them. Use `color-mix()` in CSS, or the `*-tint` token, which
 * is the translucent variant these states are meant to use anyway.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--vux-paper)',
        surface: 'var(--vux-surface)',
        ink: 'var(--vux-ink)',
        muted: 'var(--vux-muted)',
        brand: 'var(--vux-brand)',
        hairline: 'var(--vux-hairline)',

        // Layer 3 — constant in every product.
        state: {
          success: 'var(--vux-success-text)',
          'success-fill': 'var(--vux-success-fill)',
          'success-tint': 'var(--vux-success-tint)',
          attention: 'var(--vux-attention-text)',
          'attention-fill': 'var(--vux-attention-fill)',
          'attention-tint': 'var(--vux-attention-tint)',
          danger: 'var(--vux-danger-text)',
          'danger-fill': 'var(--vux-danger-fill)',
          'danger-tint': 'var(--vux-danger-tint)',
          info: 'var(--vux-info-text)',
          'info-fill': 'var(--vux-info-fill)',
          'info-tint': 'var(--vux-info-tint)',
          neutral: 'var(--vux-neutral-text)',
          'neutral-fill': 'var(--vux-neutral-fill)',
          'neutral-tint': 'var(--vux-neutral-tint)',
        },
      },

      fontFamily: {
        display: 'var(--vux-font-display)',
        sans: 'var(--vux-font-body)',
        mono: 'var(--vux-font-util)',
      },

      // [size, { lineHeight, letterSpacing }] — the two-ratio scale.
      fontSize: {
        '2xs': ['var(--vux-text-2xs)', { lineHeight: '1.4', letterSpacing: '0.16em' }],
        xs: ['var(--vux-text-xs)', { lineHeight: '1.5' }],
        base: ['var(--vux-text-sm)', { lineHeight: '1.6' }],
        md: ['var(--vux-text-md)', { lineHeight: '1.55' }],
        lg: ['var(--vux-text-lg)', { lineHeight: '1.5' }],
        'display-1': ['var(--vux-display-1)', { lineHeight: '1.2', letterSpacing: '-0.012em' }],
        'display-2': ['var(--vux-display-2)', { lineHeight: '1.12', letterSpacing: '-0.018em' }],
        'display-3': ['var(--vux-display-3)', { lineHeight: '1.06', letterSpacing: '-0.02em' }],
        'display-4': ['var(--vux-display-4)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
      },

      // 3px everywhere. `rounded` and `rounded-lg` are deliberately the same
      // value — so an absent-minded `rounded-xl` cannot drift the house style.
      borderRadius: {
        DEFAULT: 'var(--vux-radius)',
        sm: '2px',
        md: 'var(--vux-radius)',
        lg: 'var(--vux-radius)',
        xl: 'var(--vux-radius)',
      },

      transitionTimingFunction: { vux: 'var(--vux-ease)' },
      transitionDuration: {
        state: 'var(--vux-dur-state)',
        hover: 'var(--vux-dur-hover)',
        theme: 'var(--vux-dur-theme)',
      },

      // Hairlines, not shadows. `shadow` is neutralised on purpose: depth in
      // this system comes from the surface tint, which the ground formula
      // already provides in both themes.
      boxShadow: {
        DEFAULT: 'none',
        hairline: 'inset 0 0 0 1px var(--vux-hairline)',
        focus: '0 0 0 2px var(--vux-brand)',
      },
    },
  },
  plugins: [],
};

module.exports = preset;
