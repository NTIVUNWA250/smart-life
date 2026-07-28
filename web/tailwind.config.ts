import type { Config } from 'tailwindcss';
// The VUX preset maps Tailwind's names onto the custom properties in vux.css,
// so the tokens have one source of truth rather than two.
import vux from '../design-system/vux.preset.js';

const config: Config = {
  presets: [vux as Config],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kept pointing at the VUX accent so any `brand-500` still in the app
        // resolves to the right colour while the retrofit finishes. New work
        // should use `text-brand` / `bg-brand`.
        brand: {
          50: 'color-mix(in srgb, var(--vux-brand) 8%, var(--vux-paper))',
          100: 'color-mix(in srgb, var(--vux-brand) 14%, var(--vux-paper))',
          500: 'var(--vux-brand)',
          600: 'var(--vux-brand)',
          700: 'var(--vux-brand)',
          DEFAULT: 'var(--vux-brand)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
