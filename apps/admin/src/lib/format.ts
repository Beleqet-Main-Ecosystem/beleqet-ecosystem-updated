import type { Locale } from './i18n';

const tag = (locale: Locale) => (locale === 'am' ? 'am-ET' : 'en-GB');

export const formatDate = (iso: string | null | undefined, locale: Locale) =>
  iso ? new Date(iso).toLocaleDateString(tag(locale), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (iso: string | null | undefined, locale: Locale) =>
  iso ? new Date(iso).toLocaleString(tag(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const formatNumber = (value: number, locale: Locale) => value.toLocaleString(tag(locale));

/** Amounts the API stores in santim (minor units). */
export const formatMinor = (minor: number, currency: string, locale: Locale) =>
  `${currency} ${(minor / 100).toLocaleString(tag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Amounts the API stores in whole birr (contracts, listings). */
export const formatMajor = (major: number, currency: string, locale: Locale) => `${currency} ${major.toLocaleString(tag(locale))}`;

export const fullName = (person: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim() || '—';

/** Only http(s) links are opened; anything else (javascript:, data:) is dropped. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://beleqetjobs.com';

/** Free-text codes from the API (JOB_LISTING, EscrowTransaction) as plain words. */
export const words = (code: string) => code.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
