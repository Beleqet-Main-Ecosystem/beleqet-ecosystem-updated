"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TemplateSelector } from "@/portfolio/components/TemplateSelector";
import { usePortfolioTranslations } from "@/portfolio/hooks/usePortfolioTranslations";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Template picker entry point before opening the full builder.
 */
export default function PortfolioTemplatesPage() {
  const { t, locale } = usePortfolioTranslations();

  return (
    <div className="container-page space-y-8 py-8 md:py-12">
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brandGreen">
          Portfolio Builder
        </p>
        <h1 className="text-hero text-primary">{t("chooseTemplate")}</h1>
        <p className="text-sm text-ink/70">
          Pick a layout to start. You can switch templates anytime — your content
          stays the same.
        </p>
      </header>

      <TemplateSelector
        selected="modern"
        locale={locale}
        onSelect={() => undefined}
        linkMode
      />

      <div>
        <Link
          href="/portfolio"
          className={cn(
            buttonVariants({ size: "lg" }),
            "inline-flex gap-2 rounded-xl px-5",
          )}
        >
          {t("startBuilding")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
