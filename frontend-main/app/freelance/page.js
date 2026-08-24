import FreelancePageClient from './FreelancePageClient';

export const metadata = {
  title: 'Hire Top Ethiopian Freelancers & Find Projects | Beleqet Freelance',
  description:
    'Post freelance projects or work as a freelancer in Ethiopia with protected Escrow payments.',
  alternates: { canonical: 'https://beleqetjobs.com/freelance' },
  openGraph: {
    title: 'Hire Top Ethiopian Freelancers & Find Projects | Beleqet Freelance',
    description:
      'Post freelance projects or work as a freelancer in Ethiopia with protected Escrow payments.',
    url: 'https://beleqetjobs.com/freelance',
    siteName: 'Beleqet Jobs',
    images: [
      {
        url: 'https://beleqetjobs.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Beleqet Freelance',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export const revalidate = 60;

export default async function FreelancePage() {
  // Fetch live gigs — gracefully falls back to static data in FreelancePageClient
  let gigs = [];
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.beleqetjobs.com/api/v1';
    const res = await fetch(`${API}/freelance/jobs?limit=24&status=OPEN`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      gigs = data.items ?? [];
    }
  } catch {
    // Fall through to client-side fallback data
  }

  return <FreelancePageClient gigs={gigs} />;
}
