import type { Config } from 'tailwindcss';

/** Same tokens as the website (beleqet-jobs-nextjs/tailwind.config.ts), so both look like one product. */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        limeAccent: '#d8ff3e',
        obsidian: '#041603',
        forest: '#00653B',
        surface: '#FFFFFF',
        canvas: '#F6F7F4',
        slate: {
          50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569',
          700: '#26402D', 800: '#172C1D', 900: '#0D1E13', 950: '#06130A',
        },
        ink: {
          50: '#f8fafb', 100: '#f1f4f6', 200: '#e3e8ec', 300: '#cbd3da', 400: '#9aa6b2',
          500: '#6b7885', 600: '#4d5967', 700: '#364250', 800: '#212a35', 900: '#121922',
        },
        brand: { 500: '#2d9065' },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Ethiopic', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { md: '8px', xl: '12px' },
    },
  },
  plugins: [],
};
export default config;
