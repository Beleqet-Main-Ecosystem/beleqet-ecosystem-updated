"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePortfolioBuilder } from "../hooks/usePortfolioBuilder";
import { usePortfolioTranslations } from "../hooks/usePortfolioTranslations";
import { BuilderToolbar } from "../components/BuilderToolbar";
import { IndustrySelector } from "../components/IndustrySelector";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PortfolioAuthModal } from "../components/PortfolioAuthModal";
import { PortfolioSidebar } from "../components/PortfolioSidebar";
import { TemplateSelector } from "../components/TemplateSelector";
import { SectionEditor } from "./SectionEditor";
import { PreviewPanel } from "../preview/PreviewPanel";
import type { PortfolioSectionId, TemplateId } from "../types";

const VALID_TEMPLATES: TemplateId[] = [
  "modern",
  "minimal",
  "professional",
  "creative",
];

/**
 * Main portfolio builder shell — split editor + live preview.
 */
export default function PortfolioBuilderClient() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const initialTemplate = VALID_TEMPLATES.includes(templateParam as TemplateId)
    ? (templateParam as TemplateId)
    : undefined;

  const builder = usePortfolioBuilder(initialTemplate);
  const { t, locale, setLocale } = usePortfolioTranslations();
  const [activeSection, setActiveSection] =
    useState<PortfolioSectionId>("profile");

  useEffect(() => {
    if (initialTemplate && builder.loaded) {
      builder.setTemplate(initialTemplate);
    }
  }, [initialTemplate, builder.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePersist(
    action: "save" | "export" | "publish",
  ) {
    const ok = await builder.persist(action);
    if (ok) {
      toast.success(
        action === "publish" ? t("published") : t("saved"),
      );
    } else if (builder.user) {
      toast.error("Could not save portfolio. Try again.");
    }
  }

  if (!builder.loaded) {
    return (
      <div className="container-page py-16 text-center text-ink/60">
        Loading portfolio builder…
      </div>
    );
  }

  return (
    <div className="container-page space-y-6 py-8 md:py-12">
      <header className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brandGreen">
          Master Profile
        </p>
        <h1 className="text-hero text-primary">{t("builderTitle")}</h1>
        <p className="max-w-2xl text-sm text-ink/70">{t("builderSubtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LanguageSwitcher locale={locale} onChange={setLocale} />
        <IndustrySelector
          selected={builder.data.industries}
          locale={locale}
          onToggle={builder.toggleIndustry}
          label={t("selectIndustries")}
        />
      </div>

      <BuilderToolbar
        onPersist={handlePersist}
        isSaving={builder.isSaving}
        dirty={builder.dirty}
        onLocalSave={builder.saveDraftLocally}
        isAuthenticated={Boolean(builder.user)}
      />

      <TemplateSelector
        selected={builder.data.templateId}
        locale={locale}
        onSelect={builder.setTemplate}
      />

      {/* 50/50 Half-Half Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT SIDE - Sidebar + Editor */}
        <div className="flex flex-col gap-6">
          <PortfolioSidebar
            sections={builder.data.sectionOrder}
            active={activeSection}
            locale={locale}
            onSelect={setActiveSection}
            onReorder={builder.reorderSections}
          />

          <SectionEditor
            section={activeSection}
            data={builder.data}
            locale={locale}
            onChange={builder.updateData}
            onReorderProjects={builder.reorderProjects}
            onReorderCerts={builder.reorderCertifications}
            onReorderGallery={builder.reorderGallery}
          />
        </div>

        {/* RIGHT SIDE - Live Preview (50%) */}
        <div>
          <PreviewPanel data={builder.data} locale={locale} />
        </div>
      </div>

      <PortfolioAuthModal
        open={builder.authModalOpen}
        onClose={() => builder.setAuthModalOpen(false)}
        message={t("authRequired")}
      />
    </div>
  );
}