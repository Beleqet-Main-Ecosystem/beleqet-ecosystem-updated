/**
 * @module components/mobile/MobilePageShell
 * @description Reusable wrapper that provides a consistent mobile page
 *   layout: a dark gradient header area with title + optional subtitle,
 *   a scrollable content region, and automatic bottom padding to
 *   account for the fixed `MobileBottomNav`.
 *
 *   On desktop (`≥ lg`) the component behaves as a transparent
 *   passthrough so existing desktop layouts are unaffected.
 *
 * @example
 * ```tsx
 * <MobilePageShell
 *   title={t("dashboard.careerDashboard")}
 *   subtitle="Job Seeker"
 *   accent="brandGreen"
 * >
 *   <MobileStatCard label="Applied" value={42} icon={Briefcase} />
 * </MobilePageShell>
 * ```
 */

import type { ReactNode } from "react";

/**
 * Accent colour options for the gradient header.
 * Each maps to a Tailwind gradient pair used in the header.
 */
export type ShellAccent = "brandGreen" | "primary" | "cyanAccent";

/**
 * Maps a {@link ShellAccent} value to its Tailwind gradient class pair.
 */
const accentGradients: Record<ShellAccent, string> = {
  brandGreen: "from-brandGreen to-darkGreen",
  primary: "from-primary to-primary2",
  cyanAccent: "from-cyanAccent to-brandGreen",
};

/**
 * Props accepted by the {@link MobilePageShell} component.
 *
 * @property title    - The page title rendered in the gradient header.
 * @property subtitle - Optional secondary line rendered below the title.
 * @property accent   - Which gradient colour to apply to the header.
 * @property children - Page content rendered below the header.
 * @property badge    - Optional small badge text (e.g. role label) shown beside title.
 */
export interface MobilePageShellProps {
  title: string;
  subtitle?: string;
  accent?: ShellAccent;
  children: ReactNode;
  badge?: string;
}

/**
 * A consistent page wrapper for mobile dashboard screens.
 *
 * On mobile it renders a coloured header band and adds `pb-24`
 * so content isn't hidden behind `MobileBottomNav`.  On desktop
 * the component is transparent.
 *
 * @param props - {@link MobilePageShellProps}
 * @returns The rendered page shell.
 */
export default function MobilePageShell({
  title,
  subtitle,
  accent = "brandGreen",
  children,
  badge,
}: MobilePageShellProps) {
  const gradient = accentGradients[accent];

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Gradient header band – visible on all viewports. */}
      <section
        className={`
          bg-gradient-to-br ${gradient} px-5 py-12 text-white
          lg:py-14
        `}
      >
        <div className="container-page">
          {badge && (
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              {badge}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-black leading-tight lg:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          )}
        </div>
      </section>

      {/* Scrollable content with bottom padding for MobileBottomNav. */}
      <div className="container-page pb-28 pt-6 lg:pb-10 lg:pt-10">
        {children}
      </div>
    </div>
  );
}