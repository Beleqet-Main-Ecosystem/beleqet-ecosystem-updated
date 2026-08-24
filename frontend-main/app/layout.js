import './globals.css';
import GlobalNav from './components/GlobalNav';

export const metadata = {
  title: {
    default: 'Beleqet Jobs | The Ultimate Jobs & Freelance Marketplace in Ethiopia',
    template: '%s | Beleqet Jobs',
  },
  description:
    'Find verified full-time jobs, remote vacancies, and freelance gigs with secure Escrow payments in Ethiopia. Search, apply, and get hired faster on Beleqet Jobs.',
  keywords: [
    'Beleqet Jobs',
    'Beleqet Freelance',
    'Jobs in Ethiopia',
    'Ethiopian Freelancers',
    'Remote Jobs Ethiopia',
    'Vacancy in Addis Ababa',
    'Escrow Freelance Payment',
    'Ethiopian Talent Marketplace',
  ],
  authors: [{ name: 'Beleqet Ecosystem' }],
  creator: 'Beleqet Jobs',
  metadataBase: new URL('https://beleqetjobs.com'),
  alternates: { canonical: 'https://beleqetjobs.com' },
  openGraph: {
    title: 'Beleqet Jobs | Jobs & Freelance Marketplace',
    description:
      'Connect with top Ethiopian employers and skilled freelancers. Verified listings and escrow-protected projects.',
    url: 'https://beleqetjobs.com',
    siteName: 'Beleqet Jobs',
    images: [
      {
        url: 'https://beleqetjobs.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Beleqet Jobs & Freelance Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beleqet Jobs | Jobs & Freelance Marketplace',
    description: 'Find full-time jobs and freelance gigs in Ethiopia.',
    images: ['https://beleqetjobs.com/og-image.jpg'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Ethiopic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
