/**
 * @module components/mobile/MobileSectionHeader
 * @description A lightweight section divider used inside mobile dashboard
 *   pages.  Renders an optional accent line, a title, and an optional
 *   "View all" link aligned to the trailing edge.
 *
 * @example
 * ```tsx
 * <MobileSectionHeader
 *   title={t("dashboard.recentActivity")}
 *   viewAllHref="/applications"
 *   viewAllLabel={t("dashboard.viewAll")}
 * />
 * ```
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Props for the {@link MobileSectionHeader} component.
 *
 * @property title        - Section heading text.
 * @property viewAllHref  - Optional route for the trailing "View all" link.
 * @property viewAllLabel - Accessible label / visible text for the link.
 */
export interface MobileSectionHeaderProps {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}

/**
 * Renders a section header with an optional trailing "View all" link.
 *
 * The accent bar on the left provides a visual anchor that separates
 * content sections without adding excessive vertical whitespace.
 *
 * @param props - {@link MobileSectionHeaderProps}
 * @returns The rendered section header.
 */
export default function MobileSectionHeader({
  title,
  viewAllHref,
  viewAllLabel,
}: MobileSectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {/* Accent bar */}
        <span className="inline-block h-5 w-1 rounded-full bg-brandGreen" />
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
          {title}
        </h2>
      </div>

      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="flex items-center gap-0.5 text-xs font-bold text-brandGreen active:opacity-70"
        >
          {viewAllLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}