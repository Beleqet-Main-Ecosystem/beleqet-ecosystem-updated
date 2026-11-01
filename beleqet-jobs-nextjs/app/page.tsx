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
import { loadForPage } from '@/lib/build-safe';

export const revalidate = 60;
export const metadata = homePageMetadata();

export default async function HomePage() {
  const [jobs, gigs, categories] = await Promise.all([
    loadForPage<Job[]>('HomePage fetchJobs', () => fetchJobs({ limit: 6 }), []),
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
