/**
 * Landing page — Server Component.
 * Fetches live jobs and platform stats at request time (ISR, revalidate 60 s).
 * Passes data to HomepageClient for interactive rendering.
 */
import { fetchJobs, fetchStats } from '../lib/api';
import HomepageClient from './components/HomepageClient';

export const revalidate = 60;

export default async function Home() {
  // Fetch featured jobs and gigs in parallel
  const [jobsData, gigsData, stats] = await Promise.all([
    fetchJobs({ limit: 5, type: 'FULL_TIME' }),
    fetchJobs({ limit: 5, type: 'CONTRACT' }),
    fetchStats(),
  ]);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

  return (
    <HomepageClient
      featuredJobs={jobsData.items ?? []}
      featuredGigs={gigsData.items ?? []}
      stats={stats}
      appUrl={APP_URL}
    />
  );
}
