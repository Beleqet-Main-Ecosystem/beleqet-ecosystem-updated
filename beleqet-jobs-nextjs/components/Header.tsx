"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BriefcaseBusiness, Menu, X } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import PostJobButton from "@/components/PostJobButton";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations("nav");

  const employerHref =
    user && ["EMPLOYER", "ADMIN"].includes(user.role) ? "/employer" : "/post-job";

  const navItems = [
    { label: t("findJobs"),     href: "/jobs" },
    { label: t("forEmployers"), href: employerHref },
    { label: t("cvMaker"),      href: "/cv-maker" },
    { label: t("pricing"),      href: "/pricing" },
    { label: t("about"),        href: "/about" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/90 backdrop-blur-xl transition-colors duration-200">
      <div className="container-page flex h-[72px] items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5 shrink-0" aria-label={t("home")}>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-[#d8ff3e] shadow-sm transition-transform group-hover:-rotate-3">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="text-[19px] font-extrabold tracking-[-0.04em] text-primary">
            Beleqet<span className="text-brandGreen">.</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-primary text-white" : "text-ink/75 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <NotificationBell />
          <ThemeToggle />
          <HeaderAuth />
          <PostJobButton />
        </div>

        {/* Mobile actions + hamburger */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <LanguageSwitcher />
          <NotificationBell />
          <ThemeToggle />
          <HeaderAuth />
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 text-primary"
            aria-label={t("toggleMenu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center border-b border-primary/10 py-3.5 text-sm font-semibold transition-colors ${
                    active ? "text-brandGreen" : "text-primary hover:text-brandGreen"
                  }`}
                >
                  {active && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brandGreen" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5">
            <PostJobButton className="w-full" />
          </div>
        </div>
      )}
    </header>
  );
}
