import JobsPageClient from './JobsPageClient';

export const metadata = {
  title: 'All Job Openings & Vacancies in Ethiopia | Beleqet Jobs',
  description:
    'Browse thousands of verified full-time, part-time, remote, and contract jobs across Ethiopia. Search by title, location, and category.',
  alternates: { canonical: 'https://beleqetjobs.com/jobs' },
  openGraph: {
    title: 'All Job Openings & Vacancies in Ethiopia | Beleqet Jobs',
    description:
      'Browse thousands of verified full-time, part-time, remote, and contract jobs across Ethiopia.',
    url: 'https://beleqetjobs.com/jobs',
    siteName: 'Beleqet Jobs',
    images: [{ url: 'https://beleqetjobs.com/og-image.jpg', width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Job Openings & Vacancies in Ethiopia | Beleqet Jobs',
    description: 'Browse thousands of verified jobs across Ethiopia.',
    images: ['https://beleqetjobs.com/og-image.jpg'],
  },
};

export const revalidate = 60;

export default async function JobsPage() {
  let jobs = [];
  let total = 0;

  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.beleqetjobs.com/api/v1';
    const res = await fetch(`${API}/jobs?limit=12&page=1`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      jobs = data.items ?? data.data ?? [];
      total = data.total ?? 0;
    }
  } catch {
    // Falls back to static sample data in JobsPageClient
  }

  return <JobsPageClient initialJobs={jobs} initialTotal={total} />;
}
