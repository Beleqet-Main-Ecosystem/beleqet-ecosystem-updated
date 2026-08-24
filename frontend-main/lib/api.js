/**
 * Beleqet API client utility for frontend-main.
 *
 * Server-side fetches use API_URL (internal Docker network).
 * Client-side uses NEXT_PUBLIC_API_URL (public domain).
 */

const BASE =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.beleqetjobs.com/api/v1';

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
    return { items: [], total: 0 };
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
    // Fallback values so the page still renders
    return {
      activeJobs: 10000,
      hiringCompanies: 5000,
      registeredJobSeekers: 50000,
      satisfactionRate: 98,
    };
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
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';
  const base = mode === 'freelance' ? `${APP_URL}/freelance` : `${APP_URL}/jobs`;
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  if (location?.trim()) params.set('location', location.trim());
  return params.toString() ? `${base}?${params}` : base;
}
