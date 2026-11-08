/** @type {import('tailwindcss').Config} */
// Colour names match beleqet-jobs-nextjs/tailwind.config.ts, so classes read the same on web and mobile.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#041603',
        obsidian: '#041603',
        forest: '#00653B',
        brandGreen: '#00653B',
        limeAccent: '#d8ff3e',
        surface: '#FFFFFF',
        canvas: '#F6F7F4',
        muted: '#4D5967',
        border: '#E3E8EC',
        danger: '#9B2C2C',
        warn: '#8A5A00',
        ink: {
          DEFAULT: '#121922',
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
        // Dark surfaces are green-black, as on the website.
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#26402D',
          800: '#172C1D',
          900: '#0D1E13',
          950: '#06130A',
        },
      },
    },
  },
  plugins: [],
};
