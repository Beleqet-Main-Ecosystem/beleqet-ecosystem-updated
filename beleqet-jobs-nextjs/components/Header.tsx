"use client";

import { lazy, Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import HeaderAuth from "@/components/HeaderAuth";
import NotificationBell from "@/components/NotificationBell";
import PreferencesMenu from "@/components/PreferencesMenu";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n";

/**
 * Lazy-load the full-screen MobileDrawer — not needed on desktop first paint
 * and not needed until the hamburger is tapped on mobile.
 */
const MobileDrawer = lazy(() => import("@/components/mobile/MobileDrawer"));

function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Close the tools menu on outside click or Escape
  useEffect(() => {
    if (!toolsOpen) return;
    function onPointer(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setToolsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setToolsOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsOpen]);

  // Context-aware "For employers" link:
  const employerHref =
    user && ["EMPLOYER", "ADMIN"].includes(user.role)
      ? "/employer"
      : user
        ? "/post-job"
        : "/for-employers";

  const primaryNavItems = [
    { label: t("nav.findJobs"), href: "/jobs" },
    { label: t("nav.freelance"), href: "/freelance" },
  ];
  const trailingNavItems = [
    { label: t("nav.employers"), href: employerHref },
    { label: t("nav.pricing"), href: "/pricing" },
  ];

  const toolsNavItems = [
    { label: t("nav.feed"), href: "/feed", hint: t("nav.feedHint") },
    { label: t("nav.cvMaker"), href: "/cv-maker", hint: t("nav.cvMakerHint") },
    { label: t("nav.resumeBrain"), href: "/resume-brain", hint: t("nav.resumeBrainHint") },
    { label: t("nav.taxCalculator"), href: "/tax-calculator", hint: t("nav.taxCalculatorHint") },
    { label: t("nav.portfolio"), href: "/portfolio", hint: t("nav.portfolioHint") },
    { label: t("nav.voiceToText"), href: "/chat-to-text", hint: t("nav.voiceToTextHint") },
    { label: t("nav.forum"), href: "/forum", hint: t("nav.forumHint") },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isToolsActive = toolsNavItems.some((item) => isActive(item.href));

  const navLink = (item: { label: string; href: string }) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${
          active
            ? "bg-[#EEF5EF] font-semibold text-primary dark:bg-slate-800 dark:text-white"
            : "font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-ink-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-8 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label={t("header.home")}
          >
            <BrandLogo priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label={t("header.primaryNav")}>
            {primaryNavItems.map(navLink)}

            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${
                  isToolsActive || toolsOpen
                    ? "bg-[#EEF5EF] font-semibold text-primary dark:bg-slate-800 dark:text-white"
                    : "font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {t("nav.careerTools")}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${toolsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {toolsOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-xl border border-ink-200 bg-surface p-1.5 shadow-[0_16px_40px_rgba(4,22,3,0.28)] dark:border-slate-700 dark:bg-slate-900">
                  {toolsNavItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setToolsOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex flex-col gap-0.5 rounded-md px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen ${
                          active ? "bg-[#F1F7EC] dark:bg-slate-800" : "hover:bg-canvas dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="text-sm font-bold text-ink-900 dark:text-slate-100">{item.label}</span>
                        <span className="text-[13px] text-ink-600 dark:text-slate-400">{item.hint}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {trailingNavItems.map(navLink)}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <PreferencesMenu />
            {user && <NotificationBell />}
            <div className="hidden lg:block">
              <HeaderAuth />
            </div>
            <Link
              href="/post-job"
              className="hidden min-h-11 items-center rounded-md bg-limeAccent px-4 text-sm font-bold text-obsidian transition-colors hover:bg-[#c8ef2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 sm:inline-flex"
            >
              {t("header.postJob")}
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-ink-200 text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest lg:hidden dark:border-slate-700 dark:text-white"
              aria-label={t("header.openMenu")}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
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

export default function Header() {
  return <SiteHeader />;
}
