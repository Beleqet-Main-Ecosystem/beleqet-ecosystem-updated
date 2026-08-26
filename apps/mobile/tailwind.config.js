/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#041603',
        brandGreen: '#d8ff3e',
        ink: '#1a1a1a',
        muted: '#6b7280',
        surface: '#f7f5ef',
        card: '#ffffff',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
