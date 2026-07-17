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
        /* Brand — edit values in app/globals.css (:root / .dark) */
        primary: "rgb(var(--tw-primary-rgb) / <alpha-value>)",
        primary2: "rgb(var(--tw-primary2-rgb) / <alpha-value>)",
        brandGreen: "rgb(var(--tw-brandGreen-rgb) / <alpha-value>)",
        darkGreen: "rgb(var(--tw-darkGreen-rgb) / <alpha-value>)",
        lime: "rgb(var(--tw-lime-rgb) / <alpha-value>)",
        cta: "rgb(var(--tw-cta-rgb) / <alpha-value>)",

        /* Surfaces & text */
        pageBg: "rgb(var(--tw-pageBg-rgb) / <alpha-value>)",
        surface: "rgb(var(--tw-surface-rgb) / <alpha-value>)",
        headerBg: "rgb(var(--tw-headerBg-rgb) / <alpha-value>)",
        elevated: "rgb(var(--tw-elevated-rgb) / <alpha-value>)",
        muted: "rgb(var(--tw-muted-rgb) / <alpha-value>)",
        border: "rgb(var(--tw-border-rgb) / <alpha-value>)",
        ink: "rgb(var(--tw-ink-rgb) / <alpha-value>)",

        /* Fixed accents (rarely themed) */
        success: "#22C55E",
        cyanAccent: "#38BDF8",
        orangeAccent: "#F97316",
        redAccent: "#EF4444",
        purpleAccent: "#7C3AED",
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
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
