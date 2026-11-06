/**
 * Beleqet API client utility for frontend-main.
 *
 * Server-side fetches use API_URL (internal Docker network).
 * Client-side uses NEXT_PUBLIC_API_URL (public domain).
 */

const BASE =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.beleqetjobs.com/api/v1';

/**
 * During `next build` there may be no live API, so fall back to `value` and let
 * the build pass. At runtime rethrow instead: an ISR revalidation that throws
 * keeps serving the last good page, whereas a returned fallback would replace
 * it in the cache.
 */
function buildTimeFallback(err, value) {
  if (process.env.NEXT_PHASE === 'phase-production-build') return value;
  throw err;
}

/**
 * Fetch job listings from GET /api/v1/jobs.
 * Used in Server Components with ISR (revalidate every 60 s).
 *
 * @param {{ q?: string, location?: string, category?: string, type?: string, limit?: number }} params
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function fetchJobs(params = {}) {
  const url = new URL(`${BASE}/jobs`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`[api] fetchJobs failed: ${err.message}`);
    return buildTimeFallback(err, { items: [], total: 0 });
  }
}

/**
 * Fetch public platform statistics from GET /api/v1/jobs/stats.
 * Revalidates every 2 minutes.
 *
 * @returns {Promise<{ activeJobs: number, hiringCompanies: number, registeredJobSeekers: number, satisfactionRate: number }>}
 */
export async function fetchStats() {
  try {
    const res = await fetch(`${BASE}/jobs/stats`, {
      next: { revalidate: 120 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`[api] fetchStats failed: ${err.message}`);
    // Empty object, not invented figures: the homepage renders 0 / hides counts.
    return buildTimeFallback(err, {});
  }
}

/**
 * Build the search redirect URL pointing at the full Beleqet app.
 *
 * @param {string} q         - Search keyword
 * @param {string} location  - Location filter
 * @param {'jobs'|'freelance'} mode - Current hero mode
 * @returns {string}
 */
export function buildSearchUrl(q, location, mode) {
  const APP_URL = '';
  const base = mode === 'freelance' ? `${APP_URL}/freelance` : `${APP_URL}/jobs`;
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  // The portal's JobsListing reads `loc`, not `location`.
  if (location?.trim()) params.set('loc', location.trim());
  return params.toString() ? `${base}?${params}` : base;
}
