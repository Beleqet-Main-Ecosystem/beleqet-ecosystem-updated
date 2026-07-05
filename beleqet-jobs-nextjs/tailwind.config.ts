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
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
