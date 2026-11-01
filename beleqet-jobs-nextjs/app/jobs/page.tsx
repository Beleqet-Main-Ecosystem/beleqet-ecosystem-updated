import { Suspense } from 'react';
import JobsListing from '@/components/JobsListing';
import { fetchCategories, fetchJobs, type Job } from '@/lib/api';
import { loadForPage } from '@/lib/build-safe';
import { jobsPageMetadata } from '@/lib/seo/generate-metadata';

export const revalidate = 60;

export const metadata = jobsPageMetadata();

export default async function JobsPage() {
  const [jobs, categories] = await Promise.all([
    loadForPage<Job[]>('JobsPage fetchJobs', () => fetchJobs(), []),
    fetchCategories(),
  ]);

  return (
    <Suspense
      fallback={<div className="container-page py-20 text-center text-muted">Loading jobs…</div>}
    >
      <JobsListing initialJobs={jobs} categories={categories} />
    </Suspense>
  );
}
