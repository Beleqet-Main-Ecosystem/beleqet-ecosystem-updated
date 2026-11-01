import { Suspense } from 'react';
import Hero from '@/components/home/Hero';
import FeaturedJobs from '@/components/home/FeaturedJobs';
import CategorySection from '@/components/CategorySection';
import WhyChoose from '@/components/WhyChoose';
import CTABanner from '@/components/CTABanner';
import { CategoryGridSkeleton } from '@/components/Skeletons';
import { homePageMetadata } from '@/lib/seo/generate-metadata';
import { fetchJobs, fetchPlatformStats, type Job } from '@/lib/api';

export const revalidate = 60;
export const metadata = homePageMetadata();

export default async function HomePage() {
  const stats = await fetchPlatformStats().catch((err) => {
    console.error('[HomePage] fetchPlatformStats failed:', err);
    return null;
  });

  let jobs: Job[] = [];
  try {
    jobs = await fetchJobs({ limit: 9 });
  } catch (err) {
    console.error('[HomePage] fetchJobs failed:', err);
    // During next build static generation, allow fallback to empty array so build passes without live DB;
    // at runtime under ISR, rethrow so Next.js preserves the previous good cache rather than caching empty!
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      jobs = [];
    } else {
      throw err;
    }
  }

  return (
    <>
      <Hero stats={stats} />
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategorySection />
      </Suspense>
      <FeaturedJobs jobs={jobs} />
      <WhyChoose />
      <CTABanner />
    </>
  );
}
