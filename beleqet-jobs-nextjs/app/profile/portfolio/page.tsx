"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Briefcase, Pencil, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { usePortfolioQuery } from "@/portfolio/queries/portfolio-queries";
import { usePortfolioTranslations } from "@/portfolio/hooks/usePortfolioTranslations";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Authenticated portfolio management dashboard.
 */
export default function ProfilePortfolioPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = usePortfolioTranslations();
  const portfolioQuery = usePortfolioQuery(Boolean(user && ready));

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/profile/portfolio");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="container-page py-16 text-center text-ink/60">
        Loading…
      </div>
    );
  }

  const updatedAt = portfolioQuery.data?.meta.updatedAt;

  return (
    <div className="container-page space-y-8 py-8 md:py-12">
      <header className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brandGreen">
          Master Profile
        </p>
        <h1 className="text-hero text-primary">{t("managePortfolio")}</h1>
        <p className="text-sm text-ink/70">
          Your portfolio powers CVs, applications, and future AI recommendations
          from a single source of truth.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brandGreen/15 text-darkGreen">
            <Briefcase className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-extrabold text-primary">Portfolio status</h2>
          <p className="mt-2 text-sm text-ink/70">
            {portfolioQuery.data
              ? portfolioQuery.data.meta.published
                ? "Published and ready to share."
                : "Draft saved — publish when you are ready."
              : "No saved portfolio yet. Open the builder to get started."}
          </p>
          {updatedAt && (
            <p className="mt-2 text-xs text-ink/50">
              {t("lastUpdated")}: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-primary">Quick actions</h2>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/portfolio"
              className={cn(
                buttonVariants(),
                "inline-flex w-full justify-center gap-2 rounded-xl",
              )}
            >
              <Pencil className="h-4 w-4" />
              {t("openBuilder")}
            </Link>
            <Link
              href="/portfolio/templates"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex w-full justify-center gap-2 rounded-xl",
              )}
            >
              <ExternalLink className="h-4 w-4" />
              {t("templates")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
