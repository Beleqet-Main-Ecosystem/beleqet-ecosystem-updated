import HomeHero from '@/components/landing/HomeHero';
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
import {
  fetchCategories,
  fetchJobs,
  fetchOpenGigs,
  fetchPlatformStats,
  type Gig,
  type Job,
} from '@/lib/api';
import { loadForPage } from '@/lib/build-safe';

export const revalidate = 60;
export const metadata = homePageMetadata();

/** The home page: the green hero with search and live listings, then the sections from the landing design. */
export default async function HomePage() {
  const [jobs, gigs, categories, stats] = await Promise.all([
    loadForPage<Job[]>('HomePage fetchJobs', () => fetchJobs({ limit: 8 }), []),
    // Gigs only feed the hero's freelance board, so a failure there shouldn't take the page down.
    fetchOpenGigs(6).catch((): Gig[] => []),
    fetchCategories(),
    fetchPlatformStats(),
  ]);

  return (
    <>
      <HomeHero jobs={jobs} gigs={gigs} stats={stats} />
      <TrustStrip />
      <LatestJobs jobs={jobs.slice(0, 6)} />
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
