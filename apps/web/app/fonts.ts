import { Inter, Noto_Sans_Ethiopic, Sora } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Inter has no Ethiopic glyphs; the browser falls back to this per character.
export const ethiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  variable: '--font-ethiopic',
  display: 'swap',
});

// Headline font (Sora): the home hero, the logo and font-display headings.
export const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});
