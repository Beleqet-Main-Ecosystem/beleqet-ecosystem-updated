"use client";

import {
  INDUSTRY_LABELS,
  INDUSTRY_TAXONOMY,
  type IndustryTag,
} from "../constants/industries";
import type { LanguageCode } from "../types";
import { cn } from "@/lib/utils";

type IndustrySelectorProps = {
  selected: string[];
  locale: LanguageCode;
  onToggle: (tag: string) => void;
  label?: string;
};

/**
 * Multi-select industry taxonomy chips for master profile tagging.
 */
export function IndustrySelector({
  selected,
  locale,
  onToggle,
  label = "Industries",
}: IndustrySelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {INDUSTRY_TAXONOMY.map((tag) => {
          const active = selected.includes(tag);
          const copy = INDUSTRY_LABELS[tag as IndustryTag][locale];
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-brandGreen bg-brandGreen/15 text-darkGreen"
                  : "border-primary/10 bg-white text-ink/70 hover:border-primary/20",
              )}
              aria-pressed={active}
            >
              {copy}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
