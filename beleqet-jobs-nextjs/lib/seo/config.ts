/**
 * Global SEO configuration — single source of truth for all SEO-related
 * environment values and site-wide defaults.
 *
 * All values are derived from environment variables at request time so that
 * the same build can be deployed to preview / staging / production without
 * re-compilation.
 */

export interface SeoConfig {
  /** Canonical site origin (no trailing slash). */
  siteUrl: string;
  /** Human-readable site name used in `<title>`, Open Graph, JSON-LD. */
  siteName: string;
  /** Fallback description when a page does not provide its own. */
  defaultDescription: string;
  /** Path (relative to `siteUrl`) of the default Open Graph image. */
  defaultOgImage: string;
  /** Twitter/X handle (without `@`). */
  twitterHandle: string;
  /** Primary locale (BCP-47 tag). */
  defaultLocale: string;
  /** All supported locales for `hreflang` generation. */
  supportedLocales: string[];
  /** Browser theme color. */
  themeColor: string;
  /** Organisation metadata used in JSON-LD + Open Graph. */
  organization: {
    name: string;
    logo: string;
    url: string;
    email: string;
    address: string;
  };
}

function env(key: string, fallback: string): string {
  return (process.env[key] as string | undefined) ?? fallback;
}

/**
 * @returns The resolved SEO configuration for the current request.
 */
export function getSeoConfig(): SeoConfig {
  const siteUrl = env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  return {
    siteUrl,
    siteName: "Beleqet Jobs",
    defaultDescription:
      "Search verified jobs from trusted employers across Ethiopia. Discover thousands of job opportunities, get instant alerts on Telegram, and apply faster with Beleqet Vacancy Platform.",
    defaultOgImage: "/og-default.png",
    twitterHandle: "@BeleqetJobs",
    defaultLocale: "en",
    supportedLocales: ["en"],
    themeColor: "#006633",
    organization: {
      name: "Beleqet",
      logo: `${siteUrl}/logo.png`,
      url: siteUrl,
      email: "support@beleqet.com",
      address: "Addis Ababa, Ethiopia",
    },
  };
}
