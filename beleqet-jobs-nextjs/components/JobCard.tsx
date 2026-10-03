import Link from 'next/link';
import { MapPin, Building2, CheckCircle2, Flame, Sparkles, Users } from 'lucide-react';
import type { Job } from '@/lib/api';
import SaveJobButton from '@/components/SaveJobButton';

/** Formats a salary amount using the job's own currency (multi-currency support). */
function formatCurrency(amount: number, currency: string = 'ETB') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function JobCard({
  job,
  variant = 'dark',
  showMatchScore = false,
}: {
  job: Job;
  variant?: 'dark' | 'light';
  /** Set on the AI Personal Feed page to surface the computed relevanceScore. */
  showMatchScore?: boolean;
}) {
  const isLight = variant === 'light';
  const hasSalary = job.salaryMin != null || job.salaryMax != null;

  return (
    <article
      className={`group flex min-h-[320px] flex-col rounded-[22px] border p-5 transition-all duration-200 hover:-translate-y-1 ${
        job.featured
          ? isLight
            ? 'border-brandGreen/40 bg-gradient-to-b from-brandGreen/[0.04] to-white shadow-card hover:border-brandGreen hover:shadow-lg'
            : 'border-[#d8ff3e]/40 bg-white/[.08] hover:border-[#d8ff3e] hover:bg-white/[.12]'
          : isLight
            ? 'border-primary/10 bg-white shadow-card hover:border-brandGreen/40 hover:shadow-lg'
            : 'border-white/10 bg-white/[.07] hover:border-[#d8ff3e]/60 hover:bg-white/[.1]'
      }`}
    >
      {/* Top Header: Company Avatar/Logo + Actions/Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {job.companyLogo ? (
            <img
              src={job.companyLogo}
              alt={`${job.company} logo`}
              className="h-11 w-11 shrink-0 rounded-xl object-cover border border-primary/10 bg-white"
            />
          ) : (
            <span
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                isLight ? 'bg-brandGreen/10 text-brandGreen' : 'bg-[#d8ff3e] text-primary'
              }`}
            >
              <Building2 className="h-5 w-5" />
            </span>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`truncate text-xs font-semibold ${
                  isLight ? 'text-ink' : 'text-white/80'
                }`}
                title={job.company}
              >
                {job.company}
              </span>
              {job.companyVerified && (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-blue-500 fill-blue-50"
                  aria-label="Verified Employer"
                />
              )}
            </div>
            <div
              className={`flex items-center gap-1 text-[11px] ${
                isLight ? 'text-muted' : 'text-white/50'
              }`}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          </div>
        </div>

        {/* Top Badges & Save Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {job.featured && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isLight
                  ? 'bg-brandGreen text-white'
                  : 'bg-[#d8ff3e] text-primary'
              }`}
              title="Featured Job"
            >
              <Sparkles className="h-3 w-3" /> Featured
            </span>
          )}
          {job.urgent && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 text-red-500 px-2 py-0.5 text-[10px] font-bold uppercase"
              title="Urgent Hiring"
            >
              <Flame className="h-3 w-3" /> Urgent
            </span>
          )}
          {showMatchScore && typeof job.relevanceScore === 'number' && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isLight ? 'bg-brandGreen/10 text-brandGreen' : 'bg-[#d8ff3e]/20 text-[#d8ff3e]'
              }`}
            >
              {job.relevanceScore}% match
            </span>
          )}
          <SaveJobButton jobId={job.id} light={isLight} />
        </div>
      </div>

      {/* Main Content Clickable Link */}
      <Link href={`/jobs/${job.id}`} className="mt-4 flex flex-1 flex-col">
        <h3
          className={`text-base font-bold line-clamp-2 leading-snug transition-colors group-hover:text-brandGreen ${
            isLight ? 'text-primary' : 'text-white group-hover:text-[#d8ff3e]'
          }`}
        >
          {job.title}
        </h3>

        {/* Job Attributes / Metadata Tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              isLight ? 'bg-primary/5 text-ink' : 'bg-white/10 text-white/90'
            }`}
          >
            {job.type}
          </span>

          {job.experienceLevel && (
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                isLight ? 'bg-amber-500/10 text-amber-700' : 'bg-amber-400/20 text-amber-200'
              }`}
            >
              {job.experienceLevel}
            </span>
          )}

          {job.categoryLabel && (
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/30 text-blue-200'
              }`}
            >
              {job.categoryLabel}
            </span>
          )}

          {job.vacancies && job.vacancies > 1 && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                isLight ? 'bg-purple-50 text-purple-700' : 'bg-purple-900/30 text-purple-200'
              }`}
            >
              <Users className="h-3 w-3" /> {job.vacancies} openings
            </span>
          )}
        </div>

        {/* Key Skill Tags */}
        {job.tags && job.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {job.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isLight
                    ? 'bg-pageBg text-muted border border-border/60'
                    : 'bg-white/5 text-white/60 border border-white/10'
                }`}
              >
                {tag}
              </span>
            ))}
            {job.tags.length > 3 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isLight ? 'text-muted' : 'text-white/40'
                }`}
              >
                +{job.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Salary Information */}
        {hasSalary && (
          <div
            className={`mt-4 inline-flex items-baseline gap-1 text-sm font-bold ${
              isLight ? 'text-brandGreen' : 'text-[#d8ff3e]'
            }`}
          >
            <span>
              {job.salaryMin != null && formatCurrency(job.salaryMin, job.currency)}
              {job.salaryMin != null && job.salaryMax != null && ' – '}
              {job.salaryMax != null && formatCurrency(job.salaryMax, job.currency)}
            </span>
            <span className={`text-[11px] font-normal ${isLight ? 'text-muted' : 'text-white/50'}`}>
              / {job.salaryType?.toLowerCase() || 'month'}
            </span>
          </div>
        )}

        {/* Card Footer: Posted date & Expiry / Details hint */}
        <div
          className={`mt-auto flex items-center justify-between border-t pt-3.5 text-[11px] ${
            isLight ? 'border-primary/10 text-muted' : 'border-white/10 text-white/40'
          }`}
        >
          <span>Posted {job.postedAgo}</span>
          {job.expiryDate && (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              Closes {job.expiryDate}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
