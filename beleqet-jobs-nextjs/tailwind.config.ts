/**
 * @file tailwind.config.ts
 * @description Tailwind CSS configuration for the Beleqet Jobs platform.
 *
 * Extends the default theme with:
 * - **Design-system colours** from the Beleqet brand guide.
 * - **Typography** using the Inter variable font.
 * - **Border radius** and **box shadow** tokens for cards.
 * - **Keyframe animations** for the mobile drawer slide-in.
 * - **Spacing / sizing** helpers for mobile-first touch targets.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#041603",
        primary2: "#0A2C03",
        brandGreen: "#00653B",
        limeAccent: "#d8ff3e",   // hero/dashboard highlight — use instead of hardcoded #d8ff3e
        darkGreen: "#015230",
        success: "#22C55E",
        cyanAccent: "#38BDF8",
        orangeAccent: "#F97316",
        redAccent: "#EF4444",
        purpleAccent: "#7C3AED",
        /*
         * Redesign tokens. Legacy dark-mode overrides in globals.css target
         * .bg-white, .text-ink, .text-primary etc.; these names are untouched
         * by them, so redesigned components render exactly as designed.
         */
        surface: "#FFFFFF",
        canvas: "#F6F7F4",
        obsidian: "#041603",
        forest: "#00653B",
        pageBg: "#F6F7F4",
        muted: "#4D5967",
        border: "#E3E8EC",
        ink: {
          DEFAULT: "#121922",
          0: '#ffffff',
          50: '#f8fafb',
          100: '#f1f4f6',
          200: '#e3e8ec',
          300: '#cbd3da',
          400: '#9aa6b2',
          500: '#6b7885',
          600: '#4d5967',
          700: '#364250',
          800: '#212a35',
          900: '#121922',
        },

        /* ── Claude Redesign Design Tokens ── */
        brand: {
          50: '#f0f9f4',
          100: '#daf1e4',
          200: '#b6e3ca',
          300: '#85cca7',
          400: '#4fae80',
          500: '#2d9065',
          600: '#1f7551',
          700: '#1a5d42',
          800: '#164a36',
          900: '#123626',
          950: '#0b2118',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          700: '#b45309',
        },
        'ink-scale': {
          0: '#ffffff',
          50: '#f8fafb',
          100: '#f1f4f6',
          200: '#e3e8ec',
          300: '#cbd3da',
          400: '#9aa6b2',
          500: '#6b7885',
          600: '#4d5967',
          700: '#364250',
          800: '#212a35',
          900: '#121922',
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-ethiopic)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        md: "8px",
        xl: "12px",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(18 25 34 / 0.05)",
        "card-hover": "0 4px 12px rgb(18 25 34 / 0.08)",
        search: "0 8px 24px rgb(11 33 24 / 0.18)",
      },
      /* ── Mobile Dashboard module animations ──────────────── */
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 200ms ease-out forwards",
        "fade-in": "fade-in 200ms ease-out forwards",
      },
      /* ── Mobile spacing helpers ──────────────────────────── */
      spacing: {
        /** Bottom nav height used for `pb-` calculations. */
        "bottom-nav": "4.5rem",
      },
      /* ── Minimum touch target sizes (WCAG 2.5.5) ─────────── */
      minWidth: {
        "touch": "44px",
      },
      minHeight: {
        "touch": "44px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;