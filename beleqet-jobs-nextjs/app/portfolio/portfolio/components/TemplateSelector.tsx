"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  PORTFOLIO_TEMPLATES,
  type TemplateMeta,
} from "../constants/templates";
import type { LanguageCode, TemplateId } from "../types";
import { cn } from "@/lib/utils";

type TemplateSelectorProps = {
  selected: TemplateId;
  locale: LanguageCode;
  onSelect: (id: TemplateId) => void;
  linkMode?: boolean;
};

/**
 * Grid of selectable portfolio templates.
 */
export function TemplateSelector({
  selected,
  locale,
  onSelect,
  linkMode = false,
}: TemplateSelectorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PORTFOLIO_TEMPLATES.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          locale={locale}
          active={selected === template.id}
          onSelect={() => onSelect(template.id)}
          linkMode={linkMode}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  locale,
  active,
  onSelect,
  linkMode,
}: {
  template: TemplateMeta;
  locale: LanguageCode;
  active: boolean;
  onSelect: () => void;
  linkMode?: boolean;
}) {
  const inner = (
    <>
      <div
        className={cn(
          "mb-4 h-24 rounded-xl",
          template.accent,
          template.previewClass,
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-primary">
            {template.name[locale]}
          </h3>
          <p className="mt-1 text-xs text-ink/60">
            {template.description[locale]}
          </p>
        </div>
        {active && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brandGreen text-primary">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </>
  );

  if (linkMode) {
    return (
      <Link
        href={`/portfolio?template=${template.id}`}
        className={cn(
          "block rounded-2xl border p-4 transition hover:shadow-md",
          active
            ? "border-brandGreen bg-brandGreen/5"
            : "border-primary/10 bg-white",
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-4 text-left transition hover:shadow-md",
        active
          ? "border-brandGreen bg-brandGreen/5"
          : "border-primary/10 bg-white",
      )}
      aria-pressed={active}
    >
      {inner}
    </button>
  );
}
