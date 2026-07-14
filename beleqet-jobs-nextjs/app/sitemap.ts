import type { MetadataRoute } from "next";
import { getSeoConfig } from "@/lib/seo/config";
import { INDEXABLE_ROUTES, ROUTE_REGISTRY } from "@/lib/seo/route-registry";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const SITEMAP_PAGE_LIMIT = 500;
const SITEMAP_MAX_JOBS = 50_000;

interface PaginatedResponse {
  items: { id: string; createdAt?: string }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Dynamic sitemap generation.
 *
 * **Static routes** — enumerated from `route-registry.ts` so that adding a new
 * public page automatically includes it in the sitemap.
 *
 * **Dynamic routes** — fetched incrementally from the backend using
 * offset-based pagination (`page` / `limit`).  The loop stops when all pages
 * have been consumed or the hard cap (`SITEMAP_MAX_JOBS`) is reached.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = getSeoConfig();
  const base = siteUrl.replace(/\/+$/, "");

  const entries: MetadataRoute.Sitemap = [];

  // ── Static routes ──────────────────────────────────────────────────────
  for (const route of INDEXABLE_ROUTES) {
    if (route.pattern.includes("[") && route.pattern.includes("]")) {
      continue; // dynamic patterns are handled below
    }
    entries.push({
      url: `${base}${route.pattern}`,
      lastModified: new Date(),
      changeFrequency: route.changefreq,
      priority: route.priority,
    });
  }

  // ── Dynamic: jobs (paginated) ──────────────────────────────────────────
  const baseUrl = API_URL.replace(/\/+$/, "");
  let page = 1;
  let totalPages = 1;
  let jobCount = 0;

  try {
    while (page <= totalPages && jobCount < SITEMAP_MAX_JOBS) {
      const response = await fetch(
        `${baseUrl}/jobs?page=${page}&limit=${SITEMAP_PAGE_LIMIT}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      if (!response.ok) break;

      const body: PaginatedResponse = await response.json();
      const items = body.items ?? [];

      if (page === 1) {
        totalPages = body.totalPages ?? 1;
      }

      for (const job of items) {
        entries.push({
          url: `${base}/jobs/${job.id}`,
          lastModified: job.createdAt
            ? new Date(job.createdAt)
            : new Date(),
          changeFrequency: ROUTE_REGISTRY.JOB_DETAIL.changefreq,
          priority: ROUTE_REGISTRY.JOB_DETAIL.priority,
        });
      }

      jobCount += items.length;
      page++;
    }
  } catch {
    // Backend unavailable or timeout — emit entries collected so far.
  }

  return entries;
}
