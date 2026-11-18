import Link from 'next/link';
import { MapPin } from 'lucide-react';
import BookmarkButton from './BookmarkButton';
import RelativeTime from './RelativeTime';
import type { Job } from '@/lib/api';

export interface JobCardLabels {
  types?: Record<string, string>;
  save?: string;
  saved?: string;
  justNow?: string;
}

const DEFAULT_LABELS: Required<JobCardLabels> = {
  types: {
    FULL_TIME: 'Full time',
    PART_TIME: 'Part time',
    REMOTE: 'Remote',
    HYBRID: 'Hybrid',
    CONTRACT: 'Contract',
    FREELANCE: 'Freelance',
  },
  save: 'Save job',
  saved: 'Saved',
  justNow: 'Just now',
};

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function formatSalary(job: Job) {
  const { salaryMin, salaryMax, currency = 'ETB' } = job;
  if (!salaryMin) return null; // show nothing instead of vague filler
  const fmt = (n: number) => Number(n).toLocaleString('en-US');
  return salaryMax && salaryMax !== salaryMin
    ? `${fmt(salaryMin)}–${fmt(salaryMax)} ${currency}`
    : `${fmt(salaryMin)} ${currency}`;
}

function sanitizeLogoUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
    if (
      process.env.NODE_ENV !== 'production' &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export interface JobCardProps {
  job: Job;
  appUrl?: string;
  locale?: string;
  labels?: JobCardLabels;
}

export default function JobCard({
  job,
  appUrl = '',
  locale = 'en',
  labels = DEFAULT_LABELS,
}: JobCardProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const company =
    typeof job.company === 'string'
      ? job.company
      : ((job as unknown as { company?: { name?: string } }).company?.name ?? '');

  const rawLogo =
    job.companyLogo ||
    (job as unknown as { company?: { logoUrl?: string } }).company?.logoUrl;
  const logo = sanitizeLogoUrl(rawLogo);

  const salary = formatSalary(job);
  const typeLabel = mergedLabels.types[job.type] ?? job.type;
  const href = appUrl ? `${appUrl}/jobs/${job.id}` : `/jobs/${job.id}`;

  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            className="size-11 rounded-md border border-ink-200 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-md bg-brand-50 text-sm font-semibold text-brand-800"
          >
            {initials(company || job.title)}
          </span>
        )}
        <BookmarkButton label={mergedLabels.save} savedLabel={mergedLabels.saved} jobId={job.id} />
      </div>

      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug text-ink-900">
          {/* Stretched link: the whole card is clickable, bookmark button has relative z-10 */}
          <Link
            href={href}
            className="line-clamp-2 after:absolute after:inset-0 after:content-[''] group-hover:text-brand-700"
          >
            {job.title}
          </Link>
        </h3>
        {company && <p className="mt-1 truncate text-sm text-ink-600">{company}</p>}
      </div>

      {job.location && (
        <p className="flex items-center gap-1.5 text-sm text-ink-600">
          <MapPin className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
          <span className="truncate">{job.location}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {typeLabel && (
          <span className="rounded-md bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700">
            {typeLabel}
          </span>
        )}
        {salary && <span className="text-sm font-medium text-ink-900">{salary}</span>}
        <RelativeTime
          dateStr={job.createdAt}
          fallback={job.postedAgo}
          locale={locale}
          justNow={mergedLabels.justNow}
        />
      </div>
    </article>
  );
}
