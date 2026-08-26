"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Menu } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import PostJobButton from "@/components/PostJobButton";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Lazy-load the full-screen MobileDrawer — not needed on desktop first paint
 * and not needed until the hamburger is tapped on mobile.
 */
const MobileDrawer = lazy(() => import("@/components/mobile/MobileDrawer"));

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  // Context-aware "For employers" link:
  //  - Employer/Admin → goes straight to the employer dashboard
  //  - Logged-in regular user → goes to post-job (most likely next action)
  //  - Guest (not logged in) → goes to the /for-employers landing page
  const employerHref =
    user && ["EMPLOYER", "ADMIN"].includes(user.role)
      ? "/employer"
      : user
        ? "/post-job"
        : "/for-employers";

  const navItems = [
    { label: "Find jobs", href: "/jobs" },
    { label: "Freelance", href: "/freelance" },
    { label: "For employers", href: employerHref },
    { label: "CV maker", href: "/cv-maker" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Chat to text", href: "/chat-to-text" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-[#f7f5ef]/90 backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/90">
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

          {/* Desktop nav */}
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

          {/* Desktop action area */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <NotificationBell />
            <HeaderAuth />
            <PostJobButton />
          </div>

          {/* Mobile: action icons + hamburger that opens MobileDrawer */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <ThemeToggle />
            <NotificationBell />
            <HeaderAuth />
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 text-primary dark:border-slate-700 dark:text-slate-100"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/*
       * MobileDrawer is rendered outside the <header> so it can cover
       * the full viewport (fixed inset-0) without being clipped by the
       * header's z-index stacking context.
       */}
      <Suspense fallback={null}>
        {drawerOpen && (
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </Suspense>
    </>
  );
}
