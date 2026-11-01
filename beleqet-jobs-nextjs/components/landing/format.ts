import type { Gig, Job } from '@/lib/api';

/** "ETB 28,000–35,000", "ETB 28,000+", or null when the post has no salary. */
export function formatSalary(job: Pick<Job, 'salaryMin' | 'salaryMax' | 'currency'>): string | null {
  const cur = job.currency || 'ETB';
  const min = job.salaryMin ?? null;
  const max = job.salaryMax ?? null;
  if (min && max) return `${cur} ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`;
  if (min) return `${cur} ${min.toLocaleString('en-US')}+`;
  if (max) return `${cur} up to ${max.toLocaleString('en-US')}`;
  return null;
}

export function formatBudget(gig: Pick<Gig, 'budgetMin' | 'budgetMax' | 'currency'>): string {
  const cur = gig.currency || 'ETB';
  if (gig.budgetMin && gig.budgetMax && gig.budgetMin !== gig.budgetMax) {
    return `${cur} ${gig.budgetMin.toLocaleString('en-US')}–${gig.budgetMax.toLocaleString('en-US')}`;
  }
  return `${cur} ${(gig.budgetMax || gig.budgetMin).toLocaleString('en-US')}`;
}

/** Two-letter monogram for listings without a logo. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s\-–—&,.()/]+/).filter(Boolean);
  if (words.length === 0) return '·';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}
