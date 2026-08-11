/**
 * @module components/mobile/MobileDrawer
 * @description An enhanced slide-in drawer that replaces the existing
 *   hamburger dropdown on mobile.  It covers the full viewport height,
 *   includes the user avatar, role badge, locale switcher, and all
 *   navigation links.  Closes on backdrop tap or link activation.
 *
 *   The drawer animates in from the right with `translate-x` and a
 *   semi-transparent backdrop.  Body scroll is locked while the drawer
 *   is open to prevent background scrolling (iOS rubber-band fix).
 *
 * @example
 * ```tsx
 * const [drawerOpen, setDrawerOpen] = useState(false);
 * <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Briefcase,
  LayoutDashboard,
  FileText,
  Building2,
  User,
  ShieldCheck,
  Globe,
  Bell,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";
import { roleMeta } from "@/components/HeaderAuth";

/**
 * Props for the {@link MobileDrawer} component.
 *
 * @property open    - Whether the drawer is currently visible.
 * @property onClose - Callback invoked when the drawer should close.
 */
export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shape of a navigation link rendered inside the drawer.
 */
interface DrawerNavLink {
  href: string;
  labelKey: string;
  icon: typeof Briefcase;
  /** Only show when the user has one of these roles (empty = show for all). */
  roles?: string[];
}

/**
 * Navigation items displayed in the drawer.
 * Order determines the visual order in the menu.
 */
const DRAWER_LINKS: DrawerNavLink[] = [
  { href: "/jobs", labelKey: "nav.findJobs", icon: Briefcase },
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/applications", labelKey: "nav.applications", icon: FileText, roles: ["JOB_SEEKER", "FREELANCER"] },
  { href: "/employer", labelKey: "nav.employer", icon: Building2, roles: ["EMPLOYER", "ADMIN"] },
  { href: "/saved-jobs", labelKey: "nav.savedJobs", icon: Bookmark, roles: ["JOB_SEEKER"] },
  { href: "/profile", labelKey: "nav.profile", icon: User },
  { href: "/admin", labelKey: "nav.admin", icon: ShieldCheck, roles: ["ADMIN"] },
];

/**
 * Locks body scroll to prevent background scrolling when drawer is open.
 * Uses `overflow: hidden` with a `touch-action: none` fix for iOS Safari.
 *
 * @param locked - Whether to lock or unlock scroll.
 */
function lockBodyScroll(locked: boolean): void {
  if (typeof document === "undefined") return;
  document.body.style.overflow = locked ? "hidden" : "";
  document.body.style.touchAction = locked ? "none" : "";
}

/**
 * Enhanced full-screen mobile navigation drawer.
 *
 * Features:
 * - Slides in from the right with backdrop overlay.
 * - Shows user avatar, name, role badge at the top.
 * - Role-filtered navigation links with icons.
 * - Locale switcher (EN ↔ AM) for i18n support.
 * - Body scroll lock while open.
 * - Closes on backdrop tap, link navigation, or close button.
 *
 * @param props - {@link MobileDrawerProps}
 * @returns The rendered drawer (or `null` when closed).
 */
export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { t, locale, setLocale } = useTranslation();

  /**
   * Toggles between English and Amharic locales.
   */
  const toggleLocale = useCallback(() => {
    const next: SupportedLocale = locale === "en" ? "am" : "en";
    setLocale(next);
  }, [locale, setLocale]);

  /* Lock / unlock body scroll when the drawer opens / closes. */
  useEffect(() => {
    lockBodyScroll(open);
    return () => lockBodyScroll(false);
  }, [open]);

  if (!open) return null;

  const isAuthenticated = ready && !!user;

  /**
   * Filters drawer links based on the user's role.
   * Links with no `roles` array are always visible.
   */
  const visibleLinks = DRAWER_LINKS.filter((link) => {
    if (!link.roles || link.roles.length === 0) return true;
    return user ? link.roles.includes(user.role) : false;
  });

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="
          absolute top-0 right-0 bottom-0 w-[min(85vw,360px)]
          bg-[#fffdf8] shadow-xl
          animate-in slide-in-from-right duration-200
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
          <p className="text-sm font-extrabold text-primary">Menu</p>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 text-primary active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User profile card (authenticated only) */}
        {isAuthenticated && (
          <div className="border-b border-primary/10 p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brandGreen to-darkGreen text-sm font-bold uppercase text-white">
                {user!.firstName.charAt(0)}
                {user!.lastName.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">
                  {user!.firstName} {user!.lastName}
                </p>
                <p className="truncate text-xs text-muted">{user!.email}</p>
              </div>
            </div>
            <span
              className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                (roleMeta[user!.role] ?? { className: "bg-muted/10 text-muted" }).className
              }`}
            >
              {(roleMeta[user!.role] ?? { label: user!.role }).label}
            </span>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Drawer navigation">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold
                  transition-colors
                  ${active
                    ? "bg-brandGreen/10 text-brandGreen"
                    : "text-ink hover:bg-pageBg"
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(link.labelKey)}
              </Link>
            );
          })}

          {/* Auth links (unauthenticated only) */}
          {!isAuthenticated && (
            <div className="mt-3 border-t border-primary/10 pt-3">
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-ink hover:bg-pageBg"
              >
                <User className="h-5 w-5 shrink-0" /> Login
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-ink hover:bg-pageBg"
              >
                <User className="h-5 w-5 shrink-0" /> Sign Up
              </Link>
            </div>
          )}
        </nav>

        {/* Locale switcher */}
        <div className="border-t border-primary/10 p-4">
          <button
            onClick={toggleLocale}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold text-ink transition-colors hover:bg-pageBg"
          >
            <Globe className="h-5 w-5 text-brandGreen" />
            {locale === "en" ? "\u12A0\u121B\u122D\u1275 / Amharic" : "English / \u12E5\u1293\u130D\u139B\u128D"}
          </button>
        </div>
      </aside>
    </div>
  );
}