/**
 * Metadata factory system.
 *
 * # Core factory
 * `createMetadata()` produces a complete Next.js `Metadata` object with
 * `title`, `description`, `metadataBase`, `openGraph`, `twitter`,
 * `robots`, `alternates.canonical`, and `alternates.languages`.
 *
 * # Per-page factories
 * Each unique route pattern has a dedicated factory function that:
 * 1. Computes the page-specific `title` and `description` (possibly from
 *    fetched data).
 * 2. Calls `createMetadata()` so that every page inherits the same defaults
 *    (OG image, twitter card type, metadataBase, etc.).
 *
 * This guarantees zero duplication of SEO wiring across the app.
 */

import type { Metadata } from "next";
import { getSeoConfig } from "./config";
import { buildCanonical, isNoindexRoute } from "./canonical";
import { TITLES, DESCRIPTIONS } from "./constants";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Shape accepted by the core metadata factory. */
export interface MetadataInput {
  /** `<title>` content (already fully formed — no suffix appended). */
  title: string;
  /** `<meta name="description">` content. */
  description: string;
  /** Route path used to build the canonical URL. */
  path: string;
  /** Override the `noindex` / `nofollow` behaviour (default: auto-detect). */
  noindex?: boolean;
  /** Absolute URL or path (relative to `siteUrl`) for `og:image`. */
  ogImage?: string;
  /** Open Graph type. */
  ogType?: "website" | "article";
  /** ISO-8601 publish time (used with `ogType: "article"`). */
  publishedTime?: string;
  /** BCP-47 locale for this page. */
  locale?: string;
  /** Map of locale → URL for `hreflang` alternates. */
  alternates?: Record<string, string>;
}

/** The external shape of a job consumed by `jobDetailPageMetadata`. */
export interface JobMeta {
  id: string;
  title: string;
  company: string;
  location: string;
  description?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Core factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete Next.js `Metadata` object with all search-engine and
 * social-network fields set.
 *
 * Every page-specific factory delegates to this function.
 */
export function createMetadata(input: MetadataInput): Metadata {
  const {
    siteUrl,
    defaultLocale,
    defaultOgImage,
    twitterHandle,
    siteName,
  } = getSeoConfig();

  const url = buildCanonical(input.path, input.locale);
  const noindex =
    input.noindex ?? isNoindexRoute(input.path);

  const ogImageUrl = input.ogImage
    ? input.ogImage.startsWith("http")
      ? input.ogImage
      : `${siteUrl.replace(/\/+$/, "")}/${input.ogImage.replace(/^\//, "")}`
    : `${siteUrl.replace(/\/+$/, "")}/${defaultOgImage.replace(/^\//, "")}`;

  return {
    title: input.title,
    description: input.description,
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: url,
      languages: input.alternates,
    },
    openGraph: {
      type: input.ogType ?? "website",
      siteName,
      title: input.title,
      description: input.description,
      url,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      locale: input.locale ?? defaultLocale,
      ...(input.publishedTime
        ? { article: { publishedTime: input.publishedTime } }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      site: twitterHandle,
      title: input.title,
      description: input.description,
      images: [ogImageUrl],
    },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Per-page factories
// ────────────────────────────────────────────────────────────────────────────

/** Metadata for the homepage (`/`). */
export function homePageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.HOME,
    description: DESCRIPTIONS.HOME,
    path: "/",
  });
}

/** Metadata for the jobs listing page (`/jobs`). */
export function jobsPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.JOBS,
    description: DESCRIPTIONS.JOBS,
    path: "/jobs",
  });
}

/**
 * Metadata for a single job detail page (`/jobs/[id]`).
 *
 * @param job - The job data used to populate dynamic fields.
 */
export function jobDetailPageMetadata(job: JobMeta): Metadata {
  return createMetadata({
    title: TITLES.JOB_DETAIL(job.title, job.company),
    description: DESCRIPTIONS.JOB_DETAIL(
      job.title,
      job.company,
      job.location,
    ),
    path: `/jobs/${job.id}`,
    ogImage: undefined, // could be a job-specific OG image from the API
    publishedTime: undefined, // could be job.createdAt from API
  });
}

/** Metadata for the about page (`/about`). */
export function aboutPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.ABOUT,
    description: DESCRIPTIONS.ABOUT,
    path: "/about",
  });
}

/** Metadata for the pricing page (`/pricing`). */
export function pricingPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.PRICING,
    description: DESCRIPTIONS.PRICING,
    path: "/pricing",
  });
}

/** Metadata for the contact page (`/contact`). */
export function contactPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.CONTACT,
    description: DESCRIPTIONS.CONTACT,
    path: "/contact",
  });
}

/** Metadata for the login page (`/login`). */
export function loginPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.LOGIN,
    description: DESCRIPTIONS.LOGIN,
    path: "/login",
    noindex: true,
  });
}

/** Metadata for the register page (`/register`). */
export function registerPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.REGISTER,
    description: DESCRIPTIONS.REGISTER,
    path: "/register",
    noindex: true,
  });
}

/** Metadata for the forgot-password page (`/forgot-password`). */
export function forgotPasswordPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.FORGOT_PASSWORD,
    description: DESCRIPTIONS.FORGOT_PASSWORD,
    path: "/forgot-password",
    noindex: true,
  });
}

/** Metadata for the profile page (`/profile`). */
export function profilePageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.PROFILE,
    description: DESCRIPTIONS.PROFILE,
    path: "/profile",
    noindex: true,
  });
}

/** Metadata for the post-job page (`/post-job`). */
export function postJobPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.POST_JOB,
    description: DESCRIPTIONS.POST_JOB,
    path: "/post-job",
    noindex: true,
  });
}

/** Metadata for the employer dashboard (`/employer`). */
export function employerPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.EMPLOYER,
    description: DESCRIPTIONS.EMPLOYER,
    path: "/employer",
    noindex: true,
  });
}

/** Metadata for the CV maker page (`/cv-maker`). */
export function cvMakerPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.CV_MAKER,
    description: DESCRIPTIONS.CV_MAKER,
    path: "/cv-maker",
    noindex: true,
  });
}

/** Metadata for the applications page (`/applications`). */
export function applicationsPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.APPLICATIONS,
    description: DESCRIPTIONS.APPLICATIONS,
    path: "/applications",
    noindex: true,
  });
}

/** Metadata for the admin dashboard (`/admin`). */
export function adminPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.ADMIN,
    description: DESCRIPTIONS.ADMIN,
    path: "/admin",
    noindex: true,
  });
}

/** Metadata for the reset-password page (`/auth/reset-password`). */
export function resetPasswordPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.RESET_PASSWORD,
    description: DESCRIPTIONS.RESET_PASSWORD,
    path: "/auth/reset-password",
    noindex: true,
  });
}

/** Metadata for the verify-email page (`/auth/verify-email`). */
export function verifyEmailPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.VERIFY_EMAIL,
    description: DESCRIPTIONS.VERIFY_EMAIL,
    path: "/auth/verify-email",
    noindex: true,
  });
}

/** Metadata for the 404 page. */
export function notFoundPageMetadata(): Metadata {
  return createMetadata({
    title: TITLES.NOT_FOUND,
    description: DESCRIPTIONS.NOT_FOUND,
    path: "/404",
    noindex: true,
  });
}
