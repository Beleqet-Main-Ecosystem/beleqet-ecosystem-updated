/**
 * @module components/mobile/MobileBottomNav
 * @description Fixed bottom navigation bar visible **only on mobile**
 *   viewports (`< lg`).  Provides five primary destinations
 *   (Jobs, Dashboard, Post, Notifications, Profile) with active-state
 *   indicators and an accessible ARIA landmark.
 *
 *   Touch targets are a minimum of `44 × 44 px` to comply with WCAG 2.5.5
 *   and Apple / Material Design guidelines.
 *
 * @example
 * ```tsx
 * import MobileBottomNav from "@/components/mobile/MobileBottomNav";
 *
 * // Inside the root layout, rendered after <main>:
 * <MobileBottomNav />
 * ```
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutDashboard,
  Plus,
  Bell,
  User,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n";

/** Shape of a single navigation tab in the bottom bar. */
interface NavTab {
  /** Internal route path. */
  href: string;
  /** Translation key for the label. */
  labelKey: string;
  /** Lucide icon component rendered inside the touch target. */
  icon: typeof Briefcase;
  /** Whether this tab requires an active, authenticated session. */
  requiresAuth: boolean;
}

/**
 * Ordered list of navigation tabs rendered in the bottom bar.
 * The centre "Post" tab uses a raised accent style to draw attention.
 */
const NAV_TABS: NavTab[] = [
  { href: "/jobs", labelKey: "nav.findJobs", icon: Briefcase, requiresAuth: false },
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, requiresAuth: true },
  { href: "/post-job", labelKey: "action.postJob", icon: Plus, requiresAuth: true },
  { href: "/applications", labelKey: "nav.applications", icon: Bell, requiresAuth: true },
  { href: "/profile", labelKey: "nav.profile", icon: User, requiresAuth: true },
];

/**
 * Determines whether the given pathname matches a tab's href,
 * using exact equality for the root and `startsWith` for nested routes.
 *
 * @param pathname - The current router pathname.
 * @param href     - The tab's route href.
 * @returns `true` when the tab should be highlighted.
 */
function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/**
 * Renders a single tab item inside the bottom navigation bar.
 *
 * @param props.tab   - The navigation tab definition.
 * @param props.active - Whether this tab is currently active.
 * @param props.t      - The translation function for localised labels.
 */
function TabItem({
  tab,
  active,
  t,
}: {
  tab: NavTab;
  active: boolean;
  t: (key: string) => string;
}) {
  const Icon = tab.icon;
  const isPost = tab.href === "/post-job";

  return (
    <Link
      href={tab.href}
      aria-label={t(tab.labelKey)}
      aria-current={active ? "page" : undefined}
      className={`
        group relative flex flex-1 flex-col items-center justify-center
        gap-0.5 py-2 transition-colors
        ${active
          ? "text-brandGreen"
          : "text-muted hover:text-ink"
        }
      `}
    >
      {/* The "Post" button gets a raised, coloured background. */}
      {isPost ? (
        <span
          className={`
            inline-flex h-11 w-11 items-center justify-center rounded-2xl
            text-white shadow-lg transition-transform active:scale-95
            ${active
              ? "bg-brandGreen"
              : "bg-primary"
            }
          `}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
      ) : (
        <span
          className={`
            inline-flex h-11 w-11 items-center justify-center rounded-xl
            transition-colors
            ${active ? "bg-brandGreen/10" : ""}
          `}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}

      <span
        className={`
          text-[10px] font-semibold leading-tight
          ${active ? "text-brandGreen" : "text-muted"}
        `}
      >
        {t(tab.labelKey)}
      </span>

      {/* Active indicator dot */}
      {active && !isPost && (
        <span className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brandGreen" />
      )}
    </Link>
  );
}

/**
 * Fixed-position bottom navigation bar for mobile viewports.
 *
 * Features:
 * - Five primary destinations with role-aware filtering.
 * - Centre "Post Job" button with raised accent style.
 * - Safe-area-aware padding for iOS devices with home indicators.
 * - Hidden on `lg` and above (desktop uses the header nav).
 *
 * @returns The rendered bottom navigation `<nav>` element, or `null` on desktop.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { t } = useTranslation();

  const isAuthenticated = ready && !!user;

  /** Filter tabs that the current user is allowed to see. */
  const visibleTabs = NAV_TABS.filter(
    (tab) => !tab.requiresAuth || isAuthenticated,
  );

  return (
    <nav
      aria-label="Mobile navigation"
      className="
        fixed bottom-0 left-0 right-0 z-50
        border-t border-primary/10
        bg-white/95 backdrop-blur-lg
        pb-[env(safe-area-inset-bottom)]
        lg:hidden
      "
    >
      <div className="flex items-stretch">
        {visibleTabs.map((tab) => (
          <TabItem
            key={tab.href}
            tab={tab}
            active={isTabActive(pathname, tab.href)}
            t={t}
          />
        ))}
      </div>
    </nav>
  );
}