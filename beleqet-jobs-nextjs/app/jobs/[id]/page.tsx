import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JobDetail from '@/features/jobs/components/JobDetail';
import { descriptionText, parseDescription } from '@/features/jobs/description';
import { fetchJob, searchJobs, type Job } from '@/lib/api';
import { jobDetailPageMetadata } from '@/lib/seo/generate-metadata';
import { BreadcrumbSchema, JobPostingSchema } from '@/lib/seo/schemas';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await fetchJob(params.id);
  if (!job) {
    return jobDetailPageMetadata({ id: params.id, title: 'Job Not Found', company: '', location: '' });
  }
  return jobDetailPageMetadata(job);
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  // fetchJob is request-cached, so this and generateMetadata share one API call.
  const job = await fetchJob(params.id);
  if (!job) notFound();

  // Similar jobs are a nice-to-have: if they fail, the page still renders.
  const similar: Job[] = job.category
    ? await searchJobs({ category: job.category, limit: 4 })
        .then((r) => r.jobs.filter((j) => j.id !== job.id).slice(0, 3))
        .catch(() => [])
    : [];

  const description = parseDescription(job.description, job.title);
  const requirements = parseDescription(job.requirements);

  return (
    <>
      <JobPostingSchema
        job={{
          id: job.id,
          title: job.title,
          description: descriptionText([...description, ...requirements]),
          datePosted: job.createdAt ?? new Date().toISOString(),
          company: job.company,
          location: job.location,
          employmentType: job.typeCode ?? job.type,
          validThrough: job.closesAt,
          directApply: job.applyMethod === 'internal',
          salary: { min: job.salaryMin, max: job.salaryMax, currency: job.currency },
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Jobs', href: '/jobs' },
          { name: job.title, href: `/jobs/${job.id}` },
        ]}
      />
      <JobDetail job={job} description={description} requirements={requirements} similar={similar} />
    </>
  );
}
