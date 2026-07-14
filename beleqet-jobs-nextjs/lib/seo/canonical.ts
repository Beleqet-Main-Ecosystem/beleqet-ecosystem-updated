/**
 * Canonical URL helpers.
 *
 * Every exported function returns an absolute URL string suitable for use in
 * `<link rel="canonical">`, Open Graph `url`, and `<sitemap>` entries.
 */

import { getSeoConfig } from "./config";

/**
 * Build an absolute canonical URL for the given relative path.
 *
 * @param path - Relative path (e.g. `/jobs/abc-123`).
 * @param locale - Optional BCP-47 locale (appended as `?lang=` query).
 * @returns Absolute canonical URL string.
 *
 * @example
 * buildCanonical("/jobs/abc-123")
 * // → "https://beleqet.com/jobs/abc-123"
 *
 * buildCanonical("/about", "am")
 * // → "https://beleqet.com/about?lang=am"
 */
export function buildCanonical(path: string, locale?: string): string {
  const { siteUrl, defaultLocale } = getSeoConfig();
  const base = siteUrl.replace(/\/+$/, "");
  const clean = path.replace(/\/+$/, "") || "/";
  const url = `${base}${clean}`;

  if (locale && locale !== defaultLocale) {
    return `${url}?lang=${encodeURIComponent(locale)}`;
  }

  return url;
}

/**
 * Strip tracking / utility query parameters that should never appear in a
 * canonical URL.
 *
 * @param url - URL string or `URL` instance.
 * @returns A new `URL` with tracking parameters removed.
 */
export function stripTrackingParams(url: string | URL): URL {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.href);
  const tracking = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
    "source",
    "fbclid",
    "gclid",
  ]);

  for (const key of [...parsed.searchParams.keys()]) {
    if (tracking.has(key)) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed;
}

/**
 * Returns `true` when the given pathname should carry a `noindex` directive.
 *
 * @param pathname - URL pathname (e.g. `/admin/users`).
 */
export function isNoindexRoute(pathname: string): boolean {
  const noindexPatterns: RegExp[] = [
    /^\/login(?:\/|$)/,
    /^\/register(?:\/|$)/,
    /^\/forgot-password(?:\/|$)/,
    /^\/profile(?:\/|$)/,
    /^\/post-job(?:\/|$)/,
    /^\/employer(?:\/|$)/,
    /^\/cv-maker(?:\/|$)/,
    /^\/applications(?:\/|$)/,
    /^\/admin(?:\/|$)/,
    /^\/auth\//,
  ];

  return noindexPatterns.some((pattern) => pattern.test(pathname));
}
