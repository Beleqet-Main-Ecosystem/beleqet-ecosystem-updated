"use client";

import Link from 'next/link';
import type { Job } from '@/lib/api';
import JobCard from './JobCard';
import { useTranslation } from '@/lib/i18n';

export default function FeaturedJobs({ jobs }: { jobs: Job[] }) {
  const { t } = useTranslation();
  if (!jobs.length) return null;

  return (
    <section className="bg-primary text-white">
      <div className="container-page py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              {t('homeSections.nowHiring')}
            </p>
            <h2 className="text-sectionH2 tracking-tight">{t('homeSections.featuredHeading')}</h2>
            <p className="mt-2 text-sm text-white/55">
              {t('homeSections.featuredSub')}
            </p>
          </div>
          <Link
            href="/jobs"
            className="hidden shrink-0 text-sm font-bold text-[#d8ff3e] hover:underline sm:inline-block"
          >
            {t('homeSections.viewAllJobs')}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </section>
  );
}
