import { translate, type Locale } from './i18n';

/** "ETB 28,000" (whole units, grouped like the website). */
export function money(amount: number | null | undefined, currency = 'ETB'): string {
  return `${currency || 'ETB'} ${Math.round(amount ?? 0).toLocaleString('en-US')}`;
}

/** "ETB 28,000–35,000", "ETB 28,000+", or null when the post has no salary. Same as the website. */
export function formatSalary(
  job: { salaryMin?: number | null; salaryMax?: number | null; currency?: string | null },
  upTo = 'up to',
): string | null {
  const cur = job.currency || 'ETB';
  const min = job.salaryMin ?? null;
  const max = job.salaryMax ?? null;
  if (min && max) return `${cur} ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`;
  if (min) return `${cur} ${min.toLocaleString('en-US')}+`;
  if (max) return `${cur} ${upTo} ${max.toLocaleString('en-US')}`;
  return null;
}

export function formatBudget(gig: { budgetMin: number; budgetMax: number; currency?: string | null }): string {
  const cur = gig.currency || 'ETB';
  if (gig.budgetMin && gig.budgetMax && gig.budgetMin !== gig.budgetMax) {
    return `${cur} ${gig.budgetMin.toLocaleString('en-US')}–${gig.budgetMax.toLocaleString('en-US')}`;
  }
  return `${cur} ${(gig.budgetMax || gig.budgetMin).toLocaleString('en-US')}`;
}

/**
 * "3 days ago" / "ከ3 ቀናት በፊት". Hermes has no Intl.RelativeTimeFormat, so the words come from the
 * app's own translations.
 */
export function timeAgo(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const steps: [string, number][] = [
    ['years', 31536000],
    ['months', 2592000],
    ['weeks', 604800],
    ['days', 86400],
    ['hours', 3600],
    ['minutes', 60],
  ];
  for (const [unit, size] of steps) {
    const n = Math.floor(seconds / size);
    // "1 month ago", not "1 months ago": the singular keys are the unit without its "s".
    if (n >= 1) return translate(locale, `m.ago.${n === 1 ? unit.slice(0, -1) : unit}`, { n });
  }
  return translate(locale, 'm.ago.now');
}

const ENTITIES: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', amp: '&' };

/**
 * Text for a description that may be HTML (jobs imported from the old site, the website's rich
 * editor): list items become bullets, paragraphs blank lines, other tags go. Plain text is unchanged.
 */
export function plainText(text: string | null | undefined): string {
  if (!text) return '';
  if (!/<[a-z/!]|&[#a-z0-9]+;/i.test(text)) return text;
  return text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\s*<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|tr)>/gi, '\n\n')
    .replace(/<[a-z/!][^>]*>/gi, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[name.toLowerCase()] ?? match;
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dateLocale(locale: Locale) {
  return locale === 'am' ? 'am-ET' : 'en-GB';
}

/** "8 Nov". */
export function shortDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short' });
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

/** "8 Nov 2026". */
export function fullDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

/** "8 Nov, 14:30". */
export function dateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${shortDate(iso, locale)}, ${time}`;
}

/** "Mar 2025", for "Member since". */
export function monthYear(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(dateLocale(locale), { month: 'short', year: 'numeric' });
  } catch {
    return new Date(iso).toISOString().slice(0, 7);
  }
}

/** Days until an ISO date (negative once it has passed), or null. Same as the website. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 86400000) - 1;
}

export const GENDERS = ['ANY', 'MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * A job's gender as one of GENDERS. Jobs imported from the old site may say "Male", "female" or
 * "Both"; anything not clearly male or female counts as ANY. Null when the job doesn't say. Same as
 * the website.
 */
export function jobGender(value: string | null | undefined): Gender | null {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'male' || text === 'm' || text === 'ወንድ') return 'MALE';
  if (text === 'female' || text === 'f' || text === 'ሴት') return 'FEMALE';
  return 'ANY';
}

/** Two-letter monogram for people and companies without a picture. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s\-–—&,.()/]+/).filter(Boolean);
  if (words.length === 0) return '·';
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Only http(s) links from listings are opened; anything else is dropped. Same as the website. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/[^\s]+$/i.test(candidate) ? candidate : null;
}

/** "Abebe K." from a person record. */
export function shortName(person: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!person) return '';
  const last = person.lastName ? ` ${person.lastName.charAt(0)}.` : '';
  return `${person.firstName ?? ''}${last}`.trim();
}

/** The file name at the end of a URL, for attachment lists. */
export function fileName(url: string): string {
  const clean = url.split('?')[0] ?? url;
  return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1)) || url;
}
