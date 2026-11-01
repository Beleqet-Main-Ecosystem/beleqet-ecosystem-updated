import LandingHero from '@/components/landing/LandingHero';
import {
  AppAndTelegram,
  CategoryLinks,
  CtaBand,
  EscrowSection,
  FeatureTabs,
  HowItWorks,
  LatestJobs,
  TrustStrip,
  WhyBeleqet,
} from '@/components/landing/LandingSections';
import { homePageMetadata } from '@/lib/seo/generate-metadata';
import { fetchCategories, fetchJobs, fetchOpenGigs, type Gig, type Job } from '@/lib/api';

export const revalidate = 60;
export const metadata = homePageMetadata();

/**
 * During `next build` there may be no API, so render empty states; at runtime
 * rethrow so ISR keeps serving the last good page instead of caching empties.
 */
async function load<T>(label: string, fn: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[HomePage] ${label} failed:`, err);
    if (process.env.NEXT_PHASE === 'phase-production-build') return empty;
    throw err;
  }
}

export default async function HomePage() {
  const [jobs, gigs, categories] = await Promise.all([
    load<Job[]>('fetchJobs', () => fetchJobs({ limit: 6 }), []),
    // Gigs only feed the hero's freelance preview, so a failure there shouldn't take the page down.
    fetchOpenGigs(4).catch((): Gig[] => []),
    fetchCategories(),
  ]);

  return (
    <>
      <LandingHero jobs={jobs} gigs={gigs} />
      <TrustStrip />
      <LatestJobs jobs={jobs} />
      <WhyBeleqet />
      <HowItWorks />
      <EscrowSection />
      <CategoryLinks categories={categories} />
      <FeatureTabs />
      <AppAndTelegram />
      <CtaBand />
    </>
  );
}
