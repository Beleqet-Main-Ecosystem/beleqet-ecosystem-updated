'use client';

import Link from 'next/link';
import { BriefcaseBusiness, Clock3, MapPin } from 'lucide-react';
import SaveJobButton from '@/components/SaveJobButton';
import type { Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatSalary, initials, postedAgo } from '../format';

export default function JobResultCard({ job }: { job: Job }) {
  const { t, locale } = useTranslation();
  const pay = formatSalary(job);
  const monthly = !job.salaryType || job.salaryType.toLowerCase() === 'monthly';
  const typeLabel = job.typeCode ? t(`search.types.${job.typeCode}`) : job.type;

  return (
    <li
      className={`relative flex items-start gap-3.5 rounded-xl border bg-surface p-4 transition-shadow hover:shadow-card-hover md:gap-4 md:p-[22px] dark:bg-slate-900 ${
        job.featured ? 'border-forest/40 dark:border-limeAccent/40' : 'border-ink-200 dark:border-slate-800'
      }`}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-limeAccent md:h-12 md:w-12"
        aria-hidden="true"
      >
        {initials(job.company)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* The title link covers the whole card; the save button sits above it. */}
          {/* No prefetch: 20 cards would each render a job page and hit the API before anyone clicks. */}
          <Link
            href={`/jobs/${job.id}`}
            prefetch={false}
            className="text-base font-bold tracking-[-0.01em] text-ink-900 after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-forest md:text-lg dark:text-white"
          >
            {job.title}
          </Link>
          {job.featured && (
            <span className="rounded-md bg-limeAccent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-obsidian">
              {t('search.featured')}
            </span>
          )}
          {job.urgent && (
            <span className="rounded-md bg-[#FFF1E6] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#9A3412]">
              {t('search.urgent')}
            </span>
          )}
        </div>
        <span className="text-sm text-ink-700 md:text-[15px] dark:text-slate-300">{job.company}</span>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-ink-600 md:text-sm dark:text-slate-400">
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-[15px] w-[15px]" aria-hidden="true" />
              {job.location}
            </span>
          )}
          {typeLabel && (
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusiness className="h-[15px] w-[15px]" aria-hidden="true" />
              {typeLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
            <Clock3 className="h-[15px] w-[15px]" aria-hidden="true" />
            {postedAgo(job.createdAt, locale, job.postedAgo)}
          </span>
        </div>
        <b className="text-sm font-bold text-ink-900 md:text-[15px] dark:text-white">
          {pay ?? <span className="font-medium text-ink-600 dark:text-slate-400">{t('landing.salaryNotListed')}</span>}
          {pay && monthly && <span className="font-medium text-ink-600 dark:text-slate-400"> {t('search.perMonth')}</span>}
        </b>
      </div>

      <div className="relative z-10">
        <SaveJobButton jobId={job.id} variant="outline" label={`${t('search.save')} ${job.title}`} />
      </div>
    </li>
  );
}
