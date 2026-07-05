/**
 * @module components/mobile/MobileStatCard
 * @description A compact, touch-friendly stat card designed for the
 *   mobile dashboard grid.  Shows an icon, a numeric value, and a
 *   translated label.  Minimum touch target is 48 × 48 px.
 *
 * @example
 * ```tsx
 * <MobileStatCard
 *   label={t("stat.applications")}
 *   value={14}
 *   icon={FileText}
 *   trend="+3 this week"
 * />
 * ```
 */

import type { LucideIcon } from "lucide-react";

/**
 * Props for the {@link MobileStatCard} component.
 *
 * @property label - Translated label describing the metric (e.g. "Applications").
 * @property value - The primary numeric value to display.
 * @property icon  - A Lucide icon rendered at the top-left of the card.
 * @property trend - Optional trend text shown below the value (e.g. "+3 this week").
 */
export interface MobileStatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
}

/**
 * Renders a single metric card with icon, value, label, and optional trend.
 *
 * On mobile the card fills the grid cell; on desktop it sits alongside
 * up to two siblings in a three-column row.
 *
 * @param props - {@link MobileStatCardProps}
 * @returns The rendered stat card element.
 */
export default function MobileStatCard({
  label,
  value,
  icon: Icon,
  trend,
}: MobileStatCardProps) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-primary/10 bg-white p-4 active:scale-[0.98] transition-transform">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brandGreen/10 text-brandGreen">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <p className="mt-3 text-2xl font-black leading-none text-primary">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>

      {trend && (
        <p className="mt-2 text-[11px] font-semibold text-success">
          {trend}
        </p>
      )}
    </div>
  );
}