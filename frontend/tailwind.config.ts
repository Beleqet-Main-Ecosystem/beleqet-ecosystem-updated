import type { Config } from 'tailwindcss';

/**
 * Tailwind configuration for the Dark/Light Mode module.
 *
 * `darkMode: 'class'` is the strategy explicitly requested in the task brief:
 * `next-themes` toggles a `class="dark"` attribute on <html>, and every
 * `dark:` utility below reacts to that class instead of the OS media query
 * directly. This is what lets a user's *manual* selection override their
 * system preference, while `enableSystem` (see ThemeProvider.tsx) still
 * lets the system preference act as the default when no manual choice
 * has been made yet.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Named, WCAG-checked palette (see README.md "Color Palette" section
        // for contrast ratios). Kept in the Tailwind theme rather than
        // hardcoded in components so the palette has a single source of truth.
        surface: {
          light: '#FFFFFF',
          dark: '#0F172A',
        },
        surfaceMuted: {
          light: '#F1F5F9',
          dark: '#1E293B',
        },
        textPrimary: {
          light: '#0F172A',
          dark: '#F1F5F9',
        },
        textSecondary: {
          light: '#475569',
          dark: '#94A3B8',
        },
        accent: {
          light: '#2563EB',
          dark: '#60A5FA',
        },
      },
      transitionProperty: {
        theme: 'background-color, border-color, color, fill, stroke',
      },
    },
  },
  plugins: [],
};

export default config;
