"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import PostJobButton from "@/components/PostJobButton";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * Lazy-load the full-screen MobileDrawer — not needed on desktop first paint
 * and not needed until the hamburger is tapped on mobile.
 */
const MobileDrawer = lazy(() => import("@/components/mobile/MobileDrawer"));

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();

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
    { label: t("nav.findJobs"), href: "/jobs" },
    { label: t("nav.freelance"), href: "/freelance" },
    { label: t("nav.employers"), href: employerHref },
    { label: t("nav.cvMaker"), href: "/cv-maker" },
    { label: t("nav.portfolio"), href: "/portfolio" },
    { label: t("nav.chatToText"), href: "/chat-to-text" },
    { label: t("nav.pricing"), href: "/pricing" },
    { label: t("nav.about"), href: "/about" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-primary/95 backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="container-page flex h-[72px] items-center justify-between">
          {/* Logo — uses the official brand mark */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 shrink-0"
            aria-label="Beleqet Jobs home"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] overflow-hidden shadow-sm transition-transform group-hover:-rotate-3">
              <Image
                src="/logo-icon.png"
                alt="Beleqet"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <div className="flex flex-col">
              <span className="text-[19px] font-extrabold tracking-[-0.04em] text-white leading-none">
                Beleqet<span className="text-[#d8ff3e]">.</span>
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#d8ff3e] mt-0.5">
                Jobs &amp; Freelance
              </span>
            </div>
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
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop action area */}
          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <HeaderAuth />
            <PostJobButton />
          </div>

          {/* Mobile: action icons + hamburger that opens MobileDrawer */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <HeaderAuth />
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white dark:border-slate-700"
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
