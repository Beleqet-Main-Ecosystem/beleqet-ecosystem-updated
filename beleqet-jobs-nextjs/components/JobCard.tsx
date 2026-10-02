import Link from 'next/link';
import {
  MapPin,
  Building2,
  BadgeCheck,
  Sparkles,
  Flame,
  Calendar,
  Clock,
  Briefcase,
  Users,
  Banknote,
  ArrowUpRight,
} from 'lucide-react';
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
  const companyInitials = (job.company || 'C').slice(0, 2).toUpperCase();

  return (
    <article
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        isLight
          ? 'border-border/80 bg-white shadow-sm hover:border-brandGreen/50'
          : 'border-white/10 bg-white/[.07] hover:border-[#d8ff3e]/60 hover:bg-white/[.1]'
      }`}
    >
      <div>
        {/* Top Header: Company Avatar + Company Name + Badges + Bookmark */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {job.companyLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.companyLogo}
                alt={`${job.company} logo`}
                className="h-11 w-11 shrink-0 rounded-xl object-cover border border-black/5 bg-white shadow-xs"
              />
            ) : (
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                  isLight
                    ? 'bg-brandGreen/10 text-brandGreen'
                    : 'bg-[#d8ff3e] text-primary'
                }`}
              >
                {companyInitials}
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs font-semibold truncate ${
                    isLight ? 'text-ink/80' : 'text-white/80'
                  }`}
                  title={job.company}
                >
                  {job.company}
                </span>
                {job.companyVerified && (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 text-emerald-500 fill-emerald-500/20"
                    title="Verified Employer"
                  />
                )}
              </div>
              <p
                className={`text-[11px] truncate ${
                  isLight ? 'text-muted' : 'text-white/40'
                }`}
              >
                {job.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {job.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" /> Featured
              </span>
            )}
            {job.urgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-rose-600 dark:text-rose-400">
                <Flame className="h-3 w-3" /> Urgent
              </span>
            )}
            {showMatchScore && typeof job.relevanceScore === 'number' && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isLight
                    ? 'bg-brandGreen/10 text-brandGreen'
                    : 'bg-[#d8ff3e]/20 text-[#d8ff3e]'
                }`}
              >
                {job.relevanceScore}% Match
              </span>
            )}
            <SaveJobButton jobId={job.id} light={isLight} />
          </div>
        </div>

        {/* Job Title */}
        <Link href={`/jobs/${job.id}`} className="block mt-4 group-hover:text-brandGreen">
          <h3
            className={`text-base sm:text-lg font-bold leading-snug transition-colors line-clamp-2 ${
              isLight ? 'text-primary group-hover:text-brandGreen' : 'text-white group-hover:text-[#d8ff3e]'
            }`}
          >
            {job.title}
          </h3>
        </Link>

        {/* Description Excerpt Preview */}
        {job.description && (
          <p
            className={`mt-2 text-xs leading-relaxed line-clamp-2 ${
              isLight ? 'text-muted' : 'text-white/60'
            }`}
          >
            {job.description}
          </p>
        )}

        {/* Metadata Chips: Location, Job Type, Experience, Vacancies, Salary */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          {/* Location */}
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
              isLight ? 'bg-pageBg text-ink/75' : 'bg-white/10 text-white/75'
            }`}
          >
            <MapPin className="h-3 w-3 text-brandGreen shrink-0" />
            {job.location}
          </span>

          {/* Job Type (Full Time, Remote, Hybrid) */}
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              isLight
                ? 'bg-brandGreen/10 text-brandGreen'
                : 'bg-[#d8ff3e]/15 text-[#d8ff3e]'
            }`}
          >
            <Briefcase className="h-3 w-3 shrink-0" />
            {job.type}
          </span>

          {/* Experience Level */}
          {job.experienceLevel && (
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                isLight ? 'bg-pageBg text-muted' : 'bg-white/10 text-white/60'
              }`}
            >
              {job.experienceLevel}
            </span>
          )}

          {/* Vacancies (if > 1) */}
          {typeof job.vacancies === 'number' && job.vacancies > 1 && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                isLight ? 'bg-pageBg text-muted' : 'bg-white/10 text-white/60'
              }`}
            >
              <Users className="h-3 w-3 shrink-0" />
              {job.vacancies} Openings
            </span>
          )}

          {/* Salary Range */}
          {hasSalary && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/40 text-emerald-300'
              }`}
            >
              <Banknote className="h-3.5 w-3.5 shrink-0" />
              {job.salaryMin != null && formatCurrency(job.salaryMin, job.currency)}
              {job.salaryMin != null && job.salaryMax != null && ' – '}
              {job.salaryMax != null && formatCurrency(job.salaryMax, job.currency)}
            </span>
          )}
        </div>

        {/* Skill Tags */}
        {job.tags && job.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {job.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                #{tag}
              </span>
            ))}
            {job.tags.length > 4 && (
              <span
                className={`text-[10px] font-medium ${
                  isLight ? 'text-muted' : 'text-white/40'
                }`}
              >
                +{job.tags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Posted date, Applicant count, and View Link */}
      <div
        className={`mt-4 flex items-center justify-between border-t pt-3 text-[11px] ${
          isLight ? 'border-border/60 text-muted' : 'border-white/10 text-white/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {job.postedAgo}
          </span>
          {typeof job.applicationsCount === 'number' && job.applicationsCount > 0 && (
            <span>• {job.applicationsCount} applied</span>
          )}
          {job.deadline && (
            <span className="hidden sm:inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Calendar className="h-3 w-3 shrink-0" />
              Deadline: {job.deadline}
            </span>
          )}
        </div>

        <Link
          href={`/jobs/${job.id}`}
          className={`inline-flex items-center gap-0.5 font-semibold transition-colors ${
            isLight
              ? 'text-brandGreen hover:text-darkGreen'
              : 'text-[#d8ff3e] hover:underline'
          }`}
        >
          View Details <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
