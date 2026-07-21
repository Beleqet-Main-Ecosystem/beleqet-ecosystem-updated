/**
 * @module components/mobile/MobileQuickActions
 * @description A 2 × 2 (mobile) / 4-column (desktop) grid of
 *   touch-friendly quick-action buttons.  Each action shows an icon
 *   and a translated label.  Buttons navigate via `next/link`.
 *
 * @example
 * ```tsx
 * const actions = [
 *   { label: t("action.findJobs"), href: "/jobs", icon: Search },
 *   { label: t("action.myApplications"), href: "/applications", icon: FileText },
 * ];
 * <MobileQuickActions actions={actions} />
 * ```
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Definition of a single quick-action button.
 *
 * @property label - Translated label rendered below the icon.
 * @property href  - Internal route the button navigates to.
 * @property icon  - Lucide icon rendered inside the touch target.
 */
export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Props for the {@link MobileQuickActions} component.
 *
 * @property actions - Array of quick-action definitions (2–4 recommended).
 */
export interface MobileQuickActionsProps {
  actions: QuickAction[];
}

/**
 * Renders a responsive grid of quick-action buttons.
 *
 * Each button has a `min-height: 44px` touch target and visual
 * feedback on `active` (scale down) and `hover` (border highlight).
 *
 * @param props - {@link MobileQuickActionsProps}
 * @returns The rendered quick-actions grid.
 */
export default function MobileQuickActions({
  actions,
}: MobileQuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="
              flex flex-col items-center gap-2.5 rounded-2xl border
              border-primary/10 bg-white p-5 text-center
              transition-all active:scale-[0.97]
              hover:border-brandGreen hover:shadow-card
            "
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brandGreen/10 text-brandGreen">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold leading-tight text-ink">
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}