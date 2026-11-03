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

import { useEffect } from "react";
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
  Bookmark,
  Handshake,
  Sparkles,
  FileScan,
  FolderOpen,
  Calculator,
  Mic,
  MessagesSquare,
  Megaphone,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n";
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
  icon: LucideIcon;
  /** Only show when the user has one of these roles (empty = show for all). */
  roles?: string[];
  /** Only show to signed-in users. */
  auth?: boolean;
}

/**
 * Navigation items displayed in the drawer.
 * Order determines the visual order in the menu.
 */
const BROWSE_LINKS: DrawerNavLink[] = [
  { href: "/jobs", labelKey: "nav.findJobs", icon: Briefcase },
  { href: "/freelance", labelKey: "nav.freelance", icon: Handshake },
  { href: "/for-employers", labelKey: "nav.employers", icon: Megaphone },
  { href: "/pricing", labelKey: "nav.pricing", icon: Tag },
];

const TOOL_LINKS: DrawerNavLink[] = [
  { href: "/feed", labelKey: "nav.feed", icon: Sparkles, auth: true },
  { href: "/cv-maker", labelKey: "nav.cvMaker", icon: FileText },
  { href: "/resume-brain", labelKey: "nav.resumeBrain", icon: FileScan, auth: true },
  { href: "/portfolio", labelKey: "nav.portfolio", icon: FolderOpen },
  { href: "/tax-calculator", labelKey: "nav.taxCalculator", icon: Calculator },
  { href: "/chat-to-text", labelKey: "nav.voiceToText", icon: Mic, auth: true },
  { href: "/forum", labelKey: "nav.forum", icon: MessagesSquare },
];

const ACCOUNT_LINKS: DrawerNavLink[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, auth: true },
  { href: "/applications", labelKey: "nav.applications", icon: FileText, roles: ["JOB_SEEKER", "FREELANCER"] },
  { href: "/employer", labelKey: "nav.employer", icon: Building2, roles: ["EMPLOYER", "ADMIN"] },
  { href: "/applications?tab=saved", labelKey: "nav.savedJobs", icon: Bookmark, roles: ["JOB_SEEKER"] },
  { href: "/profile", labelKey: "nav.profile", icon: User, auth: true },
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
  const { t } = useTranslation();

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
  const isVisible = (link: DrawerNavLink) => {
    if (link.auth && !isAuthenticated) return false;
    if (!link.roles || link.roles.length === 0) return true;
    return user ? link.roles.includes(user.role) : false;
  };
  const sections = [
    { titleKey: "header.browse", links: BROWSE_LINKS.filter(isVisible) },
    { titleKey: "nav.careerTools", links: TOOL_LINKS.filter(isVisible) },
    { titleKey: "header.account", links: ACCOUNT_LINKS.filter(isVisible) },
  ].filter((section) => section.links.length > 0);

  return (
    <div id="mobile-drawer" className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t("header.menu")}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="
          absolute top-0 right-0 bottom-0 flex w-[min(85vw,360px)] flex-col
          bg-pageBg dark:bg-slate-900
          shadow-xl
          animate-in slide-in-from-right duration-200
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/10 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="Beleqet" width="30" height="30" className="rounded-lg" />
            <span className="text-base font-extrabold text-primary dark:text-slate-100">
              Beleqet<span className="text-brandGreen">.</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t("header.closeMenu")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/10 dark:border-slate-700 text-primary dark:text-slate-100 active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User profile card (authenticated only) */}
        {isAuthenticated && (
          <div className="border-b border-primary/10 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brandGreen to-darkGreen text-sm font-bold uppercase text-white">
                {user!.firstName.charAt(0)}
                {user!.lastName.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink dark:text-slate-100">
                  {user!.firstName} {user!.lastName}
                </p>
                <p className="truncate text-xs text-muted dark:text-slate-400">{user!.email}</p>
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
          {sections.map((section) => (
            <div key={section.titleKey} className="mb-2">
              <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.06em] text-muted dark:text-slate-400">
                {t(section.titleKey)}
              </p>
          {section.links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold
                  transition-colors
                  ${active
                    ? "bg-brandGreen/10 text-brandGreen"
                    : "text-ink dark:text-slate-200 hover:bg-pageBg dark:hover:bg-slate-800"
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(link.labelKey)}
              </Link>
            );
          })}
            </div>
          ))}

          {/* Auth links (unauthenticated only) */}
          {!isAuthenticated && (
            <div className="mt-3 border-t border-primary/10 dark:border-slate-700 pt-3">
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-ink dark:text-slate-200 hover:bg-pageBg dark:hover:bg-slate-800"
              >
                <User className="h-5 w-5 shrink-0" /> {t("auth.login")}
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-ink dark:text-slate-200 hover:bg-pageBg dark:hover:bg-slate-800"
              >
                <User className="h-5 w-5 shrink-0" /> {t("auth.signUp")}
              </Link>
            </div>
          )}
        </nav>

      </aside>
    </div>
  );
}