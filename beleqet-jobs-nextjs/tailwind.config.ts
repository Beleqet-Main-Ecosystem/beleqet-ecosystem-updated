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
        darkGreen: "#015230",
        success: "#22C55E",
        cyanAccent: "#38BDF8",
        orangeAccent: "#F97316",
        redAccent: "#EF4444",
        purpleAccent: "#7C3AED",
        pageBg: "#F5F7FA",
        muted: "#64748B",
        border: "#E2E8F0",
        ink: "#1E293B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(4,22,3,0.06), 0 1px 1px rgba(4,22,3,0.04)",
        cardHover: "0 8px 24px rgba(4,22,3,0.10)",
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