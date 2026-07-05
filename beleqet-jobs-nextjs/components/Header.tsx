/**
 * @module components/Header
 * @description Sticky responsive header with desktop navigation bar
 *   and mobile hamburger trigger.  On mobile, tapping the hamburger
 *   button opens the enhanced {@link MobileDrawer} instead of the
 *   legacy inline dropdown.  On desktop, the classic horizontal
 *   nav bar and action area are rendered.
 *
 *   The component uses `"use client"` because it depends on
 *   `usePathname` and user auth state.
 */

"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Menu } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import PostJobButton from "@/components/PostJobButton";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";

/* Lazy-load the mobile drawer — not needed on desktop first paint. */
const MobileDrawer = lazy(() => import("@/components/mobile/MobileDrawer"));

/**
 * Sticky header with responsive navigation.
 *
 * Desktop (`≥ lg`):
 * - Logo → horizontal nav links → notification bell → auth dropdown → post button.
 *
 * Mobile (`< lg`):
 * - Logo → notification bell → auth dropdown → hamburger button.
 * - Hamburger opens the full-screen `MobileDrawer` (slide-in from right).
 *
 * @returns The rendered header element.
 */
export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  /** Context-aware "For employers" link destination. */
  const employerHref =
    user && ["EMPLOYER", "ADMIN"].includes(user.role)
      ? "/employer"
      : "/post-job";

  /** Desktop navigation items. */
  const navItems = [
    { label: "Find jobs", href: "/jobs" },
    { label: "For employers", href: employerHref },
    { label: "CV maker", href: "/cv-maker" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
  ];

  /**
   * Checks whether a navigation href matches the current pathname.
   *
   * @param href - The link's destination path.
   * @returns `true` when the current route starts with `href`.
   */
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="container-page flex h-[72px] items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 shrink-0"
            aria-label="Beleqet Jobs home"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-[#d8ff3e] shadow-sm transition-transform group-hover:-rotate-3">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="text-[19px] font-extrabold tracking-[-0.04em] text-primary">
              Beleqet<span className="text-brandGreen">.</span>
            </span>
          </Link>

          {/* ── Desktop nav ────────────────────────────────── */}
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-ink/75 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ── Desktop action area ────────────────────────── */}
          <div className="hidden items-center gap-2 lg:flex">
            <NotificationBell />
            <HeaderAuth />
            <PostJobButton />
          </div>

          {/* ── Mobile: action icons + hamburger ───────────── */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <NotificationBell />
            <HeaderAuth />
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 text-primary active:scale-90 transition-transform"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer (lazy loaded) ──────────────────── */}
      <Suspense fallback={null}>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </Suspense>
    </>
  );
}