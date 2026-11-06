import OldHomePage from '@/features/old-home/OldHomePage';
import { fetchJobs, fetchStats } from '@/features/old-home/old-home-api';
import { homePageMetadata } from '@/lib/seo/generate-metadata';

export const revalidate = 60;
export const metadata = homePageMetadata();

/** The home page is the earlier landing design (features/old-home), fed with live jobs and platform stats. */
export default async function HomePage() {
  const [jobsData, gigsData, stats] = await Promise.all([
    fetchJobs({ limit: 5, type: 'FULL_TIME' }),
    fetchJobs({ limit: 5, type: 'CONTRACT' }),
    fetchStats(),
  ]);

  return <OldHomePage featuredJobs={jobsData.items ?? []} featuredGigs={gigsData.items ?? []} stats={stats} appUrl="" />;
}
