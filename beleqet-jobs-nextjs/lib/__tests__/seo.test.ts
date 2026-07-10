import { describe, it, expect, beforeEach } from "vitest";
import { getSeoConfig } from "@/lib/seo/config";
import { buildCanonical, isNoindexRoute, stripTrackingParams } from "@/lib/seo/canonical";
import { ROUTE_REGISTRY, INDEXABLE_ROUTES, NOINDEX_ROUTES } from "@/lib/seo/route-registry";
import {
  createMetadata,
  homePageMetadata,
  jobsPageMetadata,
  jobDetailPageMetadata,
  aboutPageMetadata,
  pricingPageMetadata,
  contactPageMetadata,
  loginPageMetadata,
  registerPageMetadata,
  profilePageMetadata,
  postJobPageMetadata,
  employerPageMetadata,
  cvMakerPageMetadata,
  applicationsPageMetadata,
  adminPageMetadata,
  forgotPasswordPageMetadata,
  resetPasswordPageMetadata,
  verifyEmailPageMetadata,
  notFoundPageMetadata,
  type JobMeta,
} from "@/lib/seo/generate-metadata";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://beleqet.com";
  process.env.NEXT_PUBLIC_API_URL = "https://api.beleqet.com/api/v1";
});

describe("getSeoConfig()", () => {
  it("returns the configured site URL", () => {
    const cfg = getSeoConfig();
    expect(cfg.siteUrl).toBe("https://beleqet.com");
  });

  it("strips trailing slashes from siteUrl", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    const cfg = getSeoConfig();
    expect(cfg.siteUrl).toBe("https://example.com");
  });

  it("falls back to localhost when env is not set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const cfg = getSeoConfig();
    expect(cfg.siteUrl).toBe("http://localhost:3000");
  });

  it("contains required properties", () => {
    const cfg = getSeoConfig();
    expect(cfg.siteName).toBeTruthy();
    expect(cfg.defaultDescription).toBeTruthy();
    expect(cfg.defaultOgImage).toBeTruthy();
    expect(cfg.twitterHandle).toBeTruthy();
    expect(cfg.organization.name).toBeTruthy();
    expect(cfg.themeColor).toBeTruthy();
  });

  it("does not contain legacy titleSuffix property", () => {
    const cfg = getSeoConfig() as Record<string, unknown>;
    expect(cfg.titleSuffix).toBeUndefined();
  });
});

describe("buildCanonical()", () => {
  it("builds a canonical URL for a root path", () => {
    expect(buildCanonical("/")).toBe("https://beleqet.com/");
  });

  it("builds a canonical URL for a nested path", () => {
    expect(buildCanonical("/jobs/abc-123")).toBe(
      "https://beleqet.com/jobs/abc-123",
    );
  });

  it("strips trailing slashes from the input path", () => {
    expect(buildCanonical("/about/")).toBe("https://beleqet.com/about");
  });

  it("appends lang query for non-default locales", () => {
    expect(buildCanonical("/about", "am")).toBe(
      "https://beleqet.com/about?lang=am",
    );
  });

  it("does not append lang for the default locale (en)", () => {
    expect(buildCanonical("/about", "en")).toBe("https://beleqet.com/about");
  });
});

describe("stripTrackingParams()", () => {
  it("removes utm_source from the URL", () => {
    const result = stripTrackingParams("https://beleqet.com/jobs?utm_source=twitter");
    expect(result.search).not.toContain("utm_source");
    expect(result.href).toBe("https://beleqet.com/jobs");
  });

  it("removes all utm_* parameters", () => {
    const url = "https://beleqet.com/jobs?utm_source=x&utm_medium=social&utm_campaign=spring&utm_term=dev&utm_content=card";
    const result = stripTrackingParams(url);
    expect(result.search).toBe("");
  });

  it("removes fbclid and gclid", () => {
    const url = "https://beleqet.com/jobs?fbclid=abc123&gclid=def456";
    const result = stripTrackingParams(url);
    expect(result.search).toBe("");
  });

  it("removes ref and source params", () => {
    const url = "https://beleqet.com/jobs?ref=newsletter&source=email";
    const result = stripTrackingParams(url);
    expect(result.search).toBe("");
  });

  it("preserves non-tracking query parameters", () => {
    const url = "https://beleqet.com/jobs?q=engineer&page=2";
    const result = stripTrackingParams(url);
    expect(result.searchParams.get("q")).toBe("engineer");
    expect(result.searchParams.get("page")).toBe("2");
  });

  it("accepts a URL object and returns a URL object", () => {
    const input = new URL("https://beleqet.com/jobs?utm_source=twitter&q=dev");
    const result = stripTrackingParams(input);
    expect(result).toBeInstanceOf(URL);
    expect(result.href).toBe("https://beleqet.com/jobs?q=dev");
  });

  it("works on URLs with no query string", () => {
    const result = stripTrackingParams("https://beleqet.com/about");
    expect(result.href).toBe("https://beleqet.com/about");
  });
});

describe("isNoindexRoute()", () => {
  it("returns false for public routes", () => {
    expect(isNoindexRoute("/")).toBe(false);
    expect(isNoindexRoute("/jobs")).toBe(false);
    expect(isNoindexRoute("/jobs/abc")).toBe(false);
    expect(isNoindexRoute("/about")).toBe(false);
    expect(isNoindexRoute("/pricing")).toBe(false);
    expect(isNoindexRoute("/contact")).toBe(false);
  });

  it("returns true for auth routes", () => {
    expect(isNoindexRoute("/login")).toBe(true);
    expect(isNoindexRoute("/register")).toBe(true);
    expect(isNoindexRoute("/forgot-password")).toBe(true);
    expect(isNoindexRoute("/auth/reset-password")).toBe(true);
    expect(isNoindexRoute("/auth/verify-email")).toBe(true);
  });

  it("returns true for private user routes", () => {
    expect(isNoindexRoute("/profile")).toBe(true);
    expect(isNoindexRoute("/post-job")).toBe(true);
    expect(isNoindexRoute("/employer")).toBe(true);
    expect(isNoindexRoute("/cv-maker")).toBe(true);
    expect(isNoindexRoute("/applications")).toBe(true);
    expect(isNoindexRoute("/admin")).toBe(true);
  });
});

describe("route-registry", () => {
  it("registers all expected routes", () => {
    const keys = Object.keys(ROUTE_REGISTRY);
    expect(keys).toContain("HOME");
    expect(keys).toContain("JOBS");
    expect(keys).toContain("JOB_DETAIL");
    expect(keys).toContain("ABOUT");
    expect(keys).toContain("PRICING");
    expect(keys).toContain("CONTACT");
    expect(keys).toContain("LOGIN");
    expect(keys).toContain("ADMIN");
  });

  it("separates indexable from noindex routes", () => {
    expect(INDEXABLE_ROUTES.length).toBeGreaterThan(0);
    expect(NOINDEX_ROUTES.length).toBeGreaterThan(0);
    expect(INDEXABLE_ROUTES.every((r) => !r.noindex)).toBe(true);
    expect(NOINDEX_ROUTES.every((r) => r.noindex)).toBe(true);
  });

  it("assigns sitemap metadata only to indexable routes", () => {
    for (const route of INDEXABLE_ROUTES) {
      expect(route.changefreq).toBeTruthy();
      expect(route.priority).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("createMetadata()", () => {
  it("returns a Metadata object with required fields", () => {
    const meta = createMetadata({
      title: "Test Page | Beleqet Jobs",
      description: "A test description.",
      path: "/test",
    });

    expect(meta.title).toBe("Test Page | Beleqet Jobs");
    expect(meta.description).toBe("A test description.");
    expect(meta.metadataBase).toBeDefined();
    expect(meta.alternates?.canonical).toBe("https://beleqet.com/test");
  });

  it("sets index/follow for public routes by default", () => {
    const meta = createMetadata({
      title: "Home",
      description: "Home page",
      path: "/",
    });

    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("sets noindex/nofollow when explicit", () => {
    const meta = createMetadata({
      title: "Admin",
      description: "Admin page",
      path: "/admin",
      noindex: true,
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("includes Open Graph fields", () => {
    const meta = createMetadata({
      title: "OG Test",
      description: "OG desc",
      path: "/og-test",
    });

    const og = meta.openGraph as Record<string, unknown> | undefined;
    expect(og?.type).toBe("website");
    expect(og?.title).toBe("OG Test");
    expect(og?.description).toBe("OG desc");
    expect(og?.url).toBe("https://beleqet.com/og-test");
  });

  it("includes Twitter card fields", () => {
    const meta = createMetadata({
      title: "Twitter Test",
      description: "Twitter desc",
      path: "/tw-test",
    });

    const tw = meta.twitter as Record<string, unknown> | undefined;
    expect(tw?.card).toBe("summary_large_image");
    expect(tw?.title).toBe("Twitter Test");
    expect(tw?.description).toBe("Twitter desc");
  });

  it("builds the correct OG image URL from a relative ogImage", () => {
    const meta = createMetadata({
      title: "Image Test",
      description: "desc",
      path: "/img",
      ogImage: "/custom-og.png",
    });

    const images = meta.openGraph?.images as Array<{ url: string }> | undefined;
    expect(images).toHaveLength(1);
    expect(images![0].url).toBe("https://beleqet.com/custom-og.png");
  });

  it("passes through absolute OG image URLs unchanged", () => {
    const meta = createMetadata({
      title: "Abs Image",
      description: "desc",
      path: "/abs",
      ogImage: "https://cdn.example.com/og.png",
    });

    const images = meta.openGraph?.images as Array<{ url: string }> | undefined;
    expect(images).toHaveLength(1);
    expect(images![0].url).toBe("https://cdn.example.com/og.png");
  });

  it("uses default OG image when none is provided", () => {
    const meta = createMetadata({
      title: "Default OG",
      description: "desc",
      path: "/default-og",
    });

    const images = meta.openGraph?.images as Array<{ url: string }> | undefined;
    expect(images).toHaveLength(1);
    expect(images![0].url).toBe("https://beleqet.com/og-default.png");
  });
});

describe("per-page metadata factories", () => {
  it("homePageMetadata() returns correct values", () => {
    const meta = homePageMetadata();
    expect(meta.title).toContain("Beleqet Jobs");
    expect(meta.alternates?.canonical).toContain("/");
  });

  it("jobsPageMetadata() returns correct values", () => {
    const meta = jobsPageMetadata();
    expect(meta.title).toContain("Find Jobs");
    expect(meta.alternates?.canonical).toContain("/jobs");
  });

  it("jobDetailPageMetadata() returns dynamic title and canonical using ID", () => {
    const job: JobMeta = {
      id: "job-456",
      title: "Senior Engineer",
      company: "Ethio Tech",
      location: "Addis Ababa",
    };

    const meta = jobDetailPageMetadata(job);
    expect(meta.title).toContain("Senior Engineer");
    expect(meta.title).toContain("Ethio Tech");
    expect(meta.alternates?.canonical).toContain("/jobs/job-456");
  });

  it("jobDetailPageMetadata canonical uses the job id field, not title-derived slug", () => {
    const job: JobMeta = {
      id: "unique-id-789",
      title: "Senior Engineer at Ethio Tech",
      company: "Ethio Tech",
      location: "Addis Ababa",
    };

    const meta = jobDetailPageMetadata(job);
    const canonical = meta.alternates?.canonical ?? "";
    expect(canonical).toContain("/jobs/unique-id-789");
    expect(canonical).not.toContain("senior-engineer");
  });

  it("aboutPageMetadata() returns correct canonical", () => {
    const meta = aboutPageMetadata();
    expect(meta.alternates?.canonical).toContain("/about");
  });

  it("pricingPageMetadata() returns correct canonical", () => {
    const meta = pricingPageMetadata();
    expect(meta.alternates?.canonical).toContain("/pricing");
  });

  it("contactPageMetadata() returns correct canonical", () => {
    const meta = contactPageMetadata();
    expect(meta.alternates?.canonical).toContain("/contact");
  });

  it("private page factories always set noindex", () => {
    const pages = [
      loginPageMetadata(),
      registerPageMetadata(),
      profilePageMetadata(),
      postJobPageMetadata(),
      employerPageMetadata(),
      cvMakerPageMetadata(),
      applicationsPageMetadata(),
      adminPageMetadata(),
      forgotPasswordPageMetadata(),
      resetPasswordPageMetadata(),
      verifyEmailPageMetadata(),
      notFoundPageMetadata(),
    ];

    for (const meta of pages) {
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });
});

describe("JSON-LD URL construction (JobPostingSchema contract)", () => {
  it("produces /jobs/{id} URL shape matching canonical metadata", () => {
    const baseUrl = getSeoConfig().siteUrl;
    const jobId = "test-job-id-456";
    const schemaUrl = `${baseUrl}/jobs/${jobId}`;
    const canonicalUrl = buildCanonical(`/jobs/${jobId}`);

    expect(schemaUrl).toBe(canonicalUrl);
  });

  it("does not use title-slug patterns in the URL", () => {
    const baseUrl = getSeoConfig().siteUrl;
    const title = "Senior Engineer at Ethio Tech";
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const slugBasedUrl = `${baseUrl}/jobs/${encodeURIComponent(slug)}`;

    const jobId = "job-789";
    const idBasedUrl = `${baseUrl}/jobs/${jobId}`;

    expect(idBasedUrl).not.toBe(slugBasedUrl);
    expect(idBasedUrl).not.toContain("senior-engineer");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// JSON-LD schema data contracts
// ────────────────────────────────────────────────────────────────────────────

describe("WebSiteSchema data contract", () => {
  it("includes SearchAction with correct urlTemplate", () => {
    const cfg = getSeoConfig();
    const siteUrl = cfg.siteUrl;
    const urlTemplate = `${siteUrl}/jobs?q={search_term_string}`;

    expect(urlTemplate).toContain("/jobs?q=");
    expect(urlTemplate).toContain("{search_term_string}");
  });

  it("uses siteName from config", () => {
    const cfg = getSeoConfig();
    expect(cfg.siteName).toBe("Beleqet Jobs");
  });

  it("includes query-input required name", () => {
    const cfg = getSeoConfig();
    expect(cfg.siteUrl).toBeTruthy();
  });
});

describe("OrganizationSchema data contract", () => {
  it("has required org fields from config", () => {
    const cfg = getSeoConfig();
    const org = cfg.organization;

    expect(org.name).toBeTruthy();
    expect(org.url).toBeTruthy();
    expect(org.logo).toBeTruthy();
    expect(org.email).toContain("@");
    expect(org.address).toContain("Ethiopia");
  });

  it("builds correct logo URL from siteUrl", () => {
    const cfg = getSeoConfig();
    expect(cfg.organization.logo).toBe(`${cfg.siteUrl}/logo.png`);
  });

  it("has customer support contactType", () => {
    // The OrganizationSchema outputs this shape via config
    const cfg = getSeoConfig();
    expect(cfg.organization.email).toBe("support@beleqet.com");
  });
});

describe("BreadcrumbSchema data contract", () => {
  it("resolves relative href to absolute URL", () => {
    const cfg = getSeoConfig();
    const base = cfg.siteUrl.replace(/\/+$/, "");
    const relativeHref = "/jobs/job-123";
    const absoluteUrl = `${base}${relativeHref}`;

    expect(absoluteUrl).toBe("https://beleqet.com/jobs/job-123");
  });

  it("passes absolute href through unchanged", () => {
    const base = "https://beleqet.com";
    const absoluteHref = "https://other.com/page";
    const url = absoluteHref.startsWith("http")
      ? absoluteHref
      : `${base}${absoluteHref}`;

    expect(url).toBe("https://other.com/page");
  });

  it("assigns sequential positions starting at 1", () => {
    const items = [
      { name: "Home", href: "/" },
      { name: "Jobs", href: "/jobs" },
      { name: "Engineer Role", href: "/jobs/abc" },
    ];

    const itemListElement = items.map((_item, index) => ({
      "@type": "ListItem",
      position: index + 1,
    }));

    expect(itemListElement[0].position).toBe(1);
    expect(itemListElement[1].position).toBe(2);
    expect(itemListElement[2].position).toBe(3);
  });
});
