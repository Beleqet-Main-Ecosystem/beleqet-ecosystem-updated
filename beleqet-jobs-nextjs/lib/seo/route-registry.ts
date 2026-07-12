/**
 * Route registry — a single, typed enumeration of every page in the app with
 * its SEO profile (indexing rules, sitemap metadata, etc.).
 *
 * This registry is consumed by:
 * - `generate-metadata.ts`  → per-page factory wiring
 * - `app/sitemap.ts`        → static route enumeration
 * - `app/robots.ts`         → disallow-rule generation
 */

export interface RouteSeoProfile {
  /** Route pattern (e.g. `/jobs/[id]`). */
  pattern: string;
  /** Human-readable name for debugging / grouping. */
  name: string;
  /** Whether search engines should be allowed to index this route. */
  noindex: boolean;
  /** Whether crawlers should be allowed to follow links on this route. */
  nofollow: boolean;
  /** Suggested sitemap change frequency (omitted for `noindex` routes). */
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /** Sitemap priority (0.0 – 1.0). */
  priority?: number;
}

export const ROUTE_REGISTRY: Record<string, RouteSeoProfile> = {
  HOME: {
    pattern: "/",
    name: "Home",
    noindex: false,
    nofollow: false,
    changefreq: "hourly",
    priority: 1.0,
  },
  JOBS: {
    pattern: "/jobs",
    name: "Jobs Listing",
    noindex: false,
    nofollow: false,
    changefreq: "hourly",
    priority: 0.8,
  },
  JOB_DETAIL: {
    pattern: "/jobs/[id]",
    name: "Job Detail",
    noindex: false,
    nofollow: false,
    changefreq: "daily",
    priority: 0.6,
  },
  ABOUT: {
    pattern: "/about",
    name: "About",
    noindex: false,
    nofollow: false,
    changefreq: "monthly",
    priority: 0.4,
  },
  PRICING: {
    pattern: "/pricing",
    name: "Pricing",
    noindex: false,
    nofollow: false,
    changefreq: "monthly",
    priority: 0.5,
  },
  CONTACT: {
    pattern: "/contact",
    name: "Contact",
    noindex: false,
    nofollow: false,
    changefreq: "monthly",
    priority: 0.3,
  },
  LOGIN: {
    pattern: "/login",
    name: "Login",
    noindex: true,
    nofollow: true,
  },
  REGISTER: {
    pattern: "/register",
    name: "Register",
    noindex: true,
    nofollow: true,
  },
  FORGOT_PASSWORD: {
    pattern: "/forgot-password",
    name: "Forgot Password",
    noindex: true,
    nofollow: true,
  },
  PROFILE: {
    pattern: "/profile",
    name: "Profile",
    noindex: true,
    nofollow: true,
  },
  POST_JOB: {
    pattern: "/post-job",
    name: "Post Job",
    noindex: true,
    nofollow: true,
  },
  EMPLOYER: {
    pattern: "/employer",
    name: "Employer Dashboard",
    noindex: true,
    nofollow: true,
  },
  CV_MAKER: {
    pattern: "/cv-maker",
    name: "CV Maker",
    noindex: true,
    nofollow: true,
  },
  APPLICATIONS: {
    pattern: "/applications",
    name: "Applications",
    noindex: true,
    nofollow: true,
  },
  ADMIN: {
    pattern: "/admin",
    name: "Admin",
    noindex: true,
    nofollow: true,
  },
  RESET_PASSWORD: {
    pattern: "/auth/reset-password",
    name: "Reset Password",
    noindex: true,
    nofollow: true,
  },
  VERIFY_EMAIL: {
    pattern: "/auth/verify-email",
    name: "Verify Email",
    noindex: true,
    nofollow: true,
  },
};

/** Routes that should appear in the sitemap. */
export const INDEXABLE_ROUTES: RouteSeoProfile[] = Object.values(
  ROUTE_REGISTRY,
).filter((r) => !r.noindex);

/** Routes that should be blocked from crawlers. */
export const NOINDEX_ROUTES: RouteSeoProfile[] = Object.values(
  ROUTE_REGISTRY,
).filter((r) => r.noindex);
