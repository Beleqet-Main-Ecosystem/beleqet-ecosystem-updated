export const metadata = {
  title: 'All Job Openings & Vacancies in Ethiopia',
  description:
    'Browse thousands of verified full-time, part-time, and remote jobs across Ethiopia.',
  alternates: {
    canonical: 'https://beleqetjobs.com/jobs',
  },
  openGraph: {
    title: 'All Job Openings & Vacancies in Ethiopia | Beleqet Jobs',
    description:
      'Browse thousands of verified full-time, part-time, and remote jobs across Ethiopia.',
    url: 'https://beleqetjobs.com/jobs',
    siteName: 'Beleqet Jobs',
    images: [
      {
        url: 'https://beleqetjobs.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Job Openings in Ethiopia - Beleqet Jobs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Job Openings & Vacancies in Ethiopia | Beleqet Jobs',
    description:
      'Browse thousands of verified full-time, part-time, and remote jobs across Ethiopia.',
    images: ['https://beleqetjobs.com/og-image.jpg'],
  },
};

export default function JobsPage() {
  return (
    <main>
      <h1>Jobs in Ethiopia</h1>
      <p>Browse thousands of verified full-time, part-time, and remote jobs across Ethiopia.</p>
    </main>
  );
}
