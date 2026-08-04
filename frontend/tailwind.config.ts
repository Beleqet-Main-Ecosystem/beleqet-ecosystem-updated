/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Critical for toggling dark mode via the  tag
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brandGreen: "#00653B",
        darkGreen: "#015230",
        primary: "#041603",
        success: "#22C55E",
        cyanAccent: "#38BDF8",
        orangeAccent: "#F97316",
        redAccent: "#EF4444",
        purpleAccent: "#7C3AED",
        pageBg: "#F5F7FA",
        border: "#E2E8F0",
        textInk: "#1E293B",
      },
    },
  },
  plugins: [],
}