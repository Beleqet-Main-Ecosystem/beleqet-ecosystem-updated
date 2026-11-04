import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import ApplyForm from '@/features/jobs/components/ApplyForm';
import { fetchJob } from '@/lib/api';
import { createMetadata } from '@/lib/seo/generate-metadata';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await fetchJob(params.id);
  return createMetadata({
    title: job ? `Apply: ${job.title} | Beleqet Jobs` : 'Apply | Beleqet Jobs',
    description: job ? `Apply for ${job.title} at ${job.company} on Beleqet Jobs.` : 'Apply on Beleqet Jobs.',
    path: `/jobs/${params.id}/apply`,
    noindex: true,
  });
}

/** Applying on Beleqet has its own page; jobs that take applications elsewhere go back to the job. */
export default async function ApplyPage({ params }: { params: { id: string } }) {
  const job = await fetchJob(params.id);
  if (!job) notFound();
  if (job.applyMethod !== 'internal') redirect(`/jobs/${job.id}`);

  return <ApplyForm job={{ id: job.id, title: job.title, company: job.company, location: job.location, closesAt: job.closesAt }} />;
}
