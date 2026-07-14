import type { MetadataRoute } from "next";
import { getSeoConfig } from "@/lib/seo/config";
import { NOINDEX_ROUTES } from "@/lib/seo/route-registry";

/**
 * Robots.txt rules.
 *
 * **Indexable**: Public routes (`/`, `/jobs`, `/about`, `/pricing`, `/contact`).
 *
 * **Blocked**: Auth pages, admin, employer dashboard, profile, post-job,
 * CV maker, applications — these contain user-specific content and should
 * never appear in search results.
 */
export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = getSeoConfig();
  const base = siteUrl.replace(/\/+$/, "");

  // Collect all unique path prefixes from noindex routes.
  const disallowPaths = collectDisallowPaths(NOINDEX_ROUTES.map((r) => r.pattern));

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: disallowPaths,
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

/**
 * Reduce route patterns to the shortest unique prefix for `Disallow`.
 * `/auth/reset-password` → `/auth/` (catches all auth sub-routes).
 */
function collectDisallowPaths(patterns: string[]): string[] {
  const prefixes = new Set<string>();

  for (const p of patterns) {
    // Group by first path segment when there are ≥ 2 segments
    const parts = p.replace(/^\//, "").split("/");
    if (parts.length >= 2 && parts[0] !== "[id]") {
      prefixes.add(`/${parts[0]}`);
    } else {
      prefixes.add(p);
    }
  }

  return [...prefixes].sort();
}
