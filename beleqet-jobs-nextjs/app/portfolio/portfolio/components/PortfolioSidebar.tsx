"use client";

import { SECTION_LABELS } from "../constants/sections";
import type { LanguageCode, PortfolioSectionId } from "../types";
import { SortableList } from "../components/SortableList";
import { cn } from "@/lib/utils";

type PortfolioSidebarProps = {
  sections: PortfolioSectionId[];
  active: PortfolioSectionId;
  locale: LanguageCode;
  onSelect: (section: PortfolioSectionId) => void;
  onReorder: (from: number, to: number) => void;
};

/**
 * Builder sidebar — section navigation with drag-and-drop ordering.
 */
export function PortfolioSidebar({
  sections,
  active,
  locale,
  onSelect,
  onReorder,
}: PortfolioSidebarProps) {
  const items = sections.map((id) => ({ id, sectionId: id }));

  return (
    <aside
      className="rounded-2xl border border-primary/10 bg-white p-4 shadow-sm"
      aria-label="Portfolio sections"
    >
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink/50">
        Sections
      </h2>
      <SortableList
        items={items}
        onReorder={onReorder}
        ariaLabel="Reorder portfolio sections"
        renderItem={(item) => {
          const label = SECTION_LABELS[item.sectionId][locale];
          const isActive = item.sectionId === active;
          return (
            <button
              type="button"
              onClick={() => onSelect(item.sectionId)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
                isActive
                  ? "bg-brandGreen/15 text-darkGreen"
                  : "text-ink/80 hover:bg-primary/5",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              {label}
            </button>
          );
        }}
      />
    </aside>
  );
}
