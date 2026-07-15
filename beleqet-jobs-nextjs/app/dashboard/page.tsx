/**
 * @module app/dashboard/page
 * @description Unified mobile-first dashboard that adapts its content
 *   based on the authenticated user's role.  Each role sees a
 *   prioritised set of widgets:
 *
 *   - **JOB_SEEKER / FREELANCER** → greeting, stats (applications / saved),
 *     quick actions, recent jobs, recent notifications.
 *   - **EMPLOYER / ADMIN** → greeting, stats (total / published / applications),
 *     quick actions, recent jobs, recent notifications.
 *   - **Unauthenticated** → sign-in prompt with CTA.
 *
 *   Data is fetched on mount using `authenticatedFetch` and
 *   refreshed on visibility change (tab focus) for up-to-date info.
 *   Sections are wrapped in `<Suspense>` boundaries for progressive
 *   loading with skeleton fallbacks.
 *
 * @example
 * Navigate to `/dashboard` to view the mobile-friendly overview.
 */

"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileText,
  Search,
  Eye,
  Users,
  Bookmark,
  Building2,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n";
import { authenticatedFetch } from "@/lib/auth";
import { fetchJobs } from "@/lib/api";

/* Lazy-loaded mobile components (code-split per section). */
const MobilePageShell = lazy(
  () => import("@/components/mobile/MobilePageShell"),
);
const MobileStatCard = lazy(
  () => import("@/components/mobile/MobileStatCard"),
);
const MobileQuickActions = lazy(
  () => import("@/components/mobile/MobileQuickActions"),
);
const MobileSectionHeader = lazy(
  () => import("@/components/mobile/MobileSectionHeader"),
);
const MobileJobCard = lazy(
  () => import("@/components/mobile/MobileJobCard"),
);
const MobileNotificationItem = lazy(
  () => import("@/components/mobile/MobileNotificationItem"),
);
const MobileDashboardSkeleton = lazy(
  () =>
    import("@/components/mobile/MobileSkeleton").then(
      (mod) => ({ default: mod.MobileDashboardSkeleton }),
    ),
);
const MobileQuickActionsSkeleton = lazy(
  () =>
    import("@/components/mobile/MobileSkeleton").then(
      (mod) => ({ default: mod.MobileQuickActionsSkeleton }),
    ),
);
const MobileJobCardSkeleton = lazy(
  () =>
    import("@/components/mobile/MobileSkeleton").then(
      (mod) => ({ default: mod.MobileJobCardSkeleton }),
    ),
);
const MobileNotificationItemSkeleton = lazy(
  () =>
    import("@/components/mobile/MobileSkeleton").then(
      (mod) => ({ default: mod.MobileNotificationItemSkeleton }),
    ),
);

/* ------------------------------------------------------------------ */
/*  API URL with compile-time safety guard                             */
/* ------------------------------------------------------------------ */

/**
 * Base URL for all API calls.
 *
 * @remarks
 * Falls back to `localhost` **only** in development mode.
 * In production builds (`NODE_ENV === 'production'`), a missing
 * `NEXT_PUBLIC_API_URL` triggers an immediate build-time error so
 * accidental misconfiguration never reaches users.
 */
const API_URL: string = (() => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[Dashboard] NEXT_PUBLIC_API_URL is not set. " +
        "Production builds require this variable to be defined. " +
        'Example: NEXT_PUBLIC_API_URL=https://api.beleqet.com/api/v1',
    );
  }
  return "http://localhost:4000/api/v1";
})();

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */

/**
 * Minimal, GDPR-compliant job representation for the dashboard list.
 *
 * @remarks
 * Only the fields required to render a preview card are included.
 * Sensitive or heavy payloads (full `description`, internal `tags`,
 * salary details, etc.) are intentionally excluded to minimise
 * data exposure and reduce memory overhead on mobile viewports.
 */
type DashboardJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedAgo: string;
  featured?: boolean;
};

/** Notification item matching the API shape. */
type DashboardNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

/** Aggregated dashboard statistics. */
type DashboardStats = {
  totalJobs: number;
  publishedJobs: number;
  totalApplications: number;
  savedJobs: number;
  interviews: number;
  offers: number;
};

/** Shape of a quick-action definition. */
type QuickActionDef = {
  label: string;
  href: string;
  icon: typeof Search;
};

/** Shape of a stat-card definition, with optional currency-formatted value. */
type StatCardDef = {
  label: string;
  value: number;
  icon: typeof Search;
  formattedValue?: string;
  currencyValue?: string;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Unified Mobile Dashboard page.
 *
 * This is the primary entry point for authenticated users on mobile.
 * It fetches role-specific data and renders prioritised widgets:
 * stats → quick actions → recent jobs → recent notifications.
 *
 * @returns The rendered dashboard page.
 */
export default function DashboardPage() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<DashboardJob[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Ref to track whether the component is still mounted. */
  const mountedRef = useRef(true);

  /**
   * Fetches all dashboard data in parallel.
   * Respects the mounted flag to avoid state updates after unmount.
   */
  const loadDashboard = useCallback(async () => {
    if (!user) return;

    try {
      const endpoints: Promise<Response>[] = [];

      /* Role-specific stat endpoints. */
      if (["EMPLOYER", "ADMIN"].includes(user.role)) {
        endpoints.push(authenticatedFetch(`${API_URL}/jobs/my`));
      } else {
        endpoints.push(
          authenticatedFetch(`${API_URL}/applications/my`),
        );
        endpoints.push(
          authenticatedFetch(`${API_URL}/users/saved-jobs`),
        );
      }

      /* Common endpoints. */
      endpoints.push(authenticatedFetch(`${API_URL}/users/notifications`));

      const results = await Promise.allSettled(endpoints);

      /* Parse results. */
      if (["EMPLOYER", "ADMIN"].includes(user.role)) {
        const jobsResult = results[0];
        if (jobsResult.status === "fulfilled" && jobsResult.value.ok) {
          const jobs = await jobsResult.value.json();
          const totalApps = jobs.reduce(
            (sum: number, j: { _count?: { applications: number } }) =>
              sum + (j._count?.applications ?? 0),
            0,
          );
          setStats({
            totalJobs: jobs.length,
            publishedJobs: jobs.filter(
              (j: { status: string }) => j.status === "PUBLISHED",
            ).length,
            totalApplications: totalApps,
            savedJobs: 0,
            interviews: 0,
            offers: 0,
          });
        }
        const notifResult = results[1];
        if (notifResult.status === "fulfilled" && notifResult.value.ok) {
          const notifs: DashboardNotification[] = await notifResult.value.json();
          setNotifications(notifs.slice(0, 5));
        }
      } else {
        const appsResult = results[0];
        const savedResult = results[1];
        const notifResult = results[2];

        let appCount = 0;
        if (appsResult.status === "fulfilled" && appsResult.value.ok) {
          const apps = await appsResult.value.json();
          appCount = apps.length;
        }
        let savedCount = 0;
        if (savedResult.status === "fulfilled" && savedResult.value.ok) {
          const saved = await savedResult.value.json();
          savedCount = saved.length;
        }
        setStats({
          totalJobs: 0,
          publishedJobs: 0,
          totalApplications: appCount,
          savedJobs: savedCount,
          interviews: 0,
          offers: 0,
        });

        if (notifResult.status === "fulfilled" && notifResult.value.ok) {
          const notifs: DashboardNotification[] = await notifResult.value.json();
          setNotifications(notifs.slice(0, 5));
        }
      }

      if (mountedRef.current) {
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        setError(t("common.error"));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, t]);

  /* Load data on mount and when user changes. */
  useEffect(() => {
    mountedRef.current = true;
    if (ready && user) {
      loadDashboard();
    } else if (ready && !user) {
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [ready, user, loadDashboard]);

  /* Refresh on tab focus (visibility change). */
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && user) {
        loadDashboard();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user, loadDashboard]);

  /**
   * Fetches recent public jobs and maps only the GDPR-minimal fields
   * required to render a preview card.  Full descriptions, internal
   * tags, and other heavy metadata are intentionally stripped out.
   *
   * Errors are caught silently so they never cause an unhandled
   * promise rejection that could crash the mobile UI.
   */
  useEffect(() => {
    let cancelled = false;

    fetchJobs({ limit: 5 })
      .then((jobs) => {
        if (cancelled) return;

        /* GDPR data minimisation: keep only preview-essential fields. */
        const minimal: DashboardJob[] = jobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          type: j.type,
          category: j.category,
          postedAgo: j.postedAgo,
          featured: j.featured,
        }));

        setRecentJobs(minimal);
      })
      .catch(() => {
        /* Swallow errors gracefully — the rest of the dashboard
           remains functional even if recent jobs fail to load. */
        if (!cancelled) {
          setRecentJobs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Redirect unauthenticated users. */
  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  /* ------ Loading / unauthenticated states ------ */

  if (!ready || (ready && !user)) {
    return (
      <div className="min-h-screen bg-[#f7f5ef]">
        <div className="container-page flex min-h-[60vh] items-center justify-center">
          <p className="animate-pulse text-sm text-muted">
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <Suspense fallback={null}>
        <MobileDashboardSkeleton />
      </Suspense>
    );
  }

  /* ------ Role-specific configuration ------ */

  const isEmployer = ["EMPLOYER", "ADMIN"].includes(user!.role);
  const userFirstName = user!.firstName;

  /** Page title and badge based on role. */
  const pageTitle = isEmployer
    ? t("dashboard.hiringWorkspace")
    : t("dashboard.careerDashboard");
  const pageBadge = isEmployer
    ? t("dashboard.employerBadge")
    : t("dashboard.careerBadge");
  const pageAccent = isEmployer ? "primary" : "brandGreen";

  /** Stat cards to display. */
  const statCards = isEmployer
    ? [
        { label: t("stat.totalJobs"), value: stats?.totalJobs ?? 0, icon: Briefcase, formattedValue: stats?.totalJobs?.toLocaleString(locale) },
        { label: t("stat.published"), value: stats?.publishedJobs ?? 0, icon: Eye, formattedValue: stats?.publishedJobs?.toLocaleString(locale) },
        { label: t("stat.applications"), value: stats?.totalApplications ?? 0, icon: Users, formattedValue: stats?.totalApplications?.toLocaleString(locale) },
      ]
    : [
        { label: t("stat.applications"), value: stats?.totalApplications ?? 0, icon: FileText, formattedValue: stats?.totalApplications?.toLocaleString(locale) },
        { label: t("stat.saved"), value: stats?.savedJobs ?? 0, icon: Bookmark, formattedValue: stats?.savedJobs?.toLocaleString(locale) },
      ];

  /** Quick actions based on role. */
  const quickActions: QuickActionDef[] = isEmployer
    ? [
        { label: t("action.postJob"), href: "/post-job", icon: Plus },
        { label: t("action.hiringDashboard"), href: "/employer", icon: Building2 },
        { label: t("action.browseJobs"), href: "/jobs", icon: Search },
        { label: t("action.editProfile"), href: "/profile", icon: UserIcon },
      ]
    : [
        { label: t("action.findJobs"), href: "/jobs", icon: Search },
        { label: t("action.myApplications"), href: "/applications", icon: FileText },
        { label: t("action.editProfile"), href: "/profile", icon: UserIcon },
      ];

  /* ------ Render ------ */

  return (
    <Suspense fallback={<MobileDashboardSkeleton />}>
      <MobilePageShell
        title={`${t("dashboard.greeting")}, ${userFirstName}`}
        subtitle={pageTitle}
        badge={pageBadge}
        accent={pageAccent}
      >
        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-2xl bg-redAccent/10 p-4 text-center">
            <p className="text-sm font-semibold text-redAccent">{error}</p>
            <button
              onClick={loadDashboard}
              className="mt-2 text-xs font-bold text-redAccent underline"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {/* ── Stats Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {statCards.map((card) => (
            <Suspense
              key={card.label}
              fallback={<div className="h-28 rounded-2xl border border-primary/10 bg-white animate-pulse" />}
            >
              <MobileStatCard
                label={card.label}
                value={card.value}
                icon={card.icon}
                formattedValue={card.formattedValue}
              />
            </Suspense>
          ))}
        </div>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <div className="mt-6">
          <Suspense fallback={<MobileQuickActionsSkeleton />}>
            <MobileQuickActions actions={quickActions} />
          </Suspense>
        </div>

        {/* ── Recent Jobs ────────────────────────────────────── */}
        <div className="mt-8">
          <Suspense
            fallback={
              <div className="mb-4 flex items-center gap-2.5">
                <div className="h-5 w-1 rounded-full bg-pageBg animate-pulse" />
                <div className="h-4 w-28 rounded bg-pageBg animate-pulse" />
              </div>
            }
          >
            <MobileSectionHeader
              title={t("nav.findJobs")}
              viewAllHref="/jobs"
              viewAllLabel={t("dashboard.viewAll")}
            />
          </Suspense>

          <div className="space-y-3">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <Suspense
                  key={job.id}
                  fallback={<MobileJobCardSkeleton />}
                >
                  <MobileJobCard job={job} />
                </Suspense>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
                <Briefcase className="mx-auto h-7 w-7 text-muted" />
                <p className="mt-3 text-sm font-semibold text-muted">
                  {t("common.noData")}
                </p>
                <Link
                  href="/jobs"
                  className="mt-3 inline-flex text-sm font-bold text-brandGreen"
                >
                  {t("nav.findJobs")}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Notifications ───────────────────────────── */}
        {notifications.length > 0 && (
          <div className="mt-8">
            <Suspense
              fallback={
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="h-5 w-1 rounded-full bg-pageBg animate-pulse" />
                  <div className="h-4 w-36 rounded bg-pageBg animate-pulse" />
                </div>
              }
            >
              <MobileSectionHeader
                title={t("dashboard.recentActivity")}
                viewAllHref="/applications"
                viewAllLabel={t("dashboard.viewAll")}
              />
            </Suspense>

            <div className="space-y-2.5">
              {notifications.slice(0, 3).map((notif) => (
                <Suspense
                  key={notif.id}
                  fallback={<MobileNotificationItemSkeleton />}
                >
                  <MobileNotificationItem item={notif} />
                </Suspense>
              ))}
            </div>
          </div>
        )}
      </MobilePageShell>
    </Suspense>
  );
}