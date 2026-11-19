import Link from 'next/link';
import JobCard, { JobCardLabels } from './JobCard';
import type { Job } from '@/lib/api';

export interface FeaturedJobsProps {
  jobs?: Job[];
  appUrl?: string;
  locale?: string;
  title?: string;
  viewAllLabel?: string;
  labels?: JobCardLabels;
}

export default function FeaturedJobs({
  jobs = [],
  appUrl = '',
  locale = 'en',
  title = 'Featured Opportunities',
  viewAllLabel = 'View all jobs',
  labels,
}: FeaturedJobsProps) {
  if (!jobs.length) return null;

  const viewAllHref = appUrl ? `${appUrl}/jobs` : '/jobs';

  return (
    <section className="container-page py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
        <Link
          href={viewAllHref}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {viewAllLabel} &rarr;
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.slice(0, 9).map((job) => (
          <JobCard key={job.id} job={job} appUrl={appUrl} locale={locale} labels={labels} />
        ))}
      </div>
    </section>
  );
}
