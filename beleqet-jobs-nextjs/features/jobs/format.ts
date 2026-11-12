import type { Gig, Job } from '@/lib/api';

/** "ETB 28,000–35,000", "ETB 28,000+", or null when the post has no salary. */
export function formatSalary(job: Pick<Job, 'salaryMin' | 'salaryMax' | 'currency'>, upTo = 'up to'): string | null {
  const cur = job.currency || 'ETB';
  const min = job.salaryMin ?? null;
  const max = job.salaryMax ?? null;
  if (min && max) return `${cur} ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`;
  if (min) return `${cur} ${min.toLocaleString('en-US')}+`;
  if (max) return `${cur} ${upTo} ${max.toLocaleString('en-US')}`;
  return null;
}

export function formatBudget(gig: Pick<Gig, 'budgetMin' | 'budgetMax' | 'currency'>): string {
  const cur = gig.currency || 'ETB';
  if (gig.budgetMin && gig.budgetMax && gig.budgetMin !== gig.budgetMax) {
    return `${cur} ${gig.budgetMin.toLocaleString('en-US')}–${gig.budgetMax.toLocaleString('en-US')}`;
  }
  return `${cur} ${(gig.budgetMax || gig.budgetMin).toLocaleString('en-US')}`;
}

/** "2 hours ago" / "ከ2 ሰዓታት በፊት", from an ISO timestamp. */
export function postedAgo(iso: string | null | undefined, locale: string, fallback: string): string {
  if (!iso) return fallback;
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'am' ? 'am' : 'en', { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

/**
 * Listing-supplied links are only used when they are http(s); anything else
 * (javascript:, data:, relative paths) is dropped rather than rendered.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? '';
  // No ? & = , ; so the address can't add fields to the mailto: link.
  return /^[^\s@<>"'?&=,;]+@[^\s@<>"'?&=,;]+\.[^\s@<>"'?&=,;]+$/.test(email) ? email : null;
}

/** Days until an ISO date (negative once it has passed), or null. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  // Applications stay open through the whole closing day.
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 86400000) - 1;
}

export const GENDERS = ['ANY', 'MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * A job's gender as one of GENDERS. Jobs imported from the old site may say "Male", "female" or
 * "Both"; anything not clearly male or female counts as ANY. Null when the job doesn't say.
 */
export function jobGender(value: string | null | undefined): Gender | null {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'male' || text === 'm' || text === 'ወንድ') return 'MALE';
  if (text === 'female' || text === 'f' || text === 'ሴት') return 'FEMALE';
  return 'ANY';
}

/** Two-letter monogram for listings without a logo. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s\-–—&,.()/]+/).filter(Boolean);
  if (words.length === 0) return '·';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

/** "Mar 2025" (or the Amharic month), for "Member since". */
export function monthYear(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { month: 'short', year: 'numeric' });
}
