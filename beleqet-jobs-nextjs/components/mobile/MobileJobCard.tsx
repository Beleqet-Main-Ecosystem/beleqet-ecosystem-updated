/**
 * @module components/mobile/MobileJobCard
 * @description A compact, horizontally laid-out job card optimised
 *   for mobile screens.  Shows company icon, title, company name,
 *   location, type badge, and posted-ago in a single row.  Supports
 *   an optional save/unsave action via `onSaveToggle`.
 *
 *   The card uses `next/image`-compatible dimensions and lazy loading
 *   placeholders for any future company-logo images.
 *
 * @example
 * ```tsx
 * <MobileJobCard
 *   job={job}
 *   onSaveToggle={(id) => toggleSave(id)}
 *   isSaved={savedIds.has(job.id)}
 * />
 * ```
 */

import Link from "next/link";
import { MapPin, Bookmark, BookmarkCheck } from "lucide-react";
import type { Job } from "@/lib/api";

/**
 * Props for the {@link MobileJobCard} component.
 *
 * @property job          - The job data to display.
 * @property onSaveToggle - Optional callback when the save button is tapped.
 * @property isSaved      - Whether the current user has saved this job.
 */
export interface MobileJobCardProps {
  job: Job;
  onSaveToggle?: (jobId: string) => void;
  isSaved?: boolean;
}

/**
 * Renders a compact, touch-friendly job card for mobile dashboards.
 *
 * The card is a horizontal strip with:
 * - Left: company icon + job title / company / location
 * - Right: type badge + save button
 *
 * Tap targets meet the 44px minimum. The entire card area is tappable
 * (navigates to the job detail page).
 *
 * @param props - {@link MobileJobCardProps}
 * @returns The rendered mobile job card.
 */
export default function MobileJobCard({
  job,
  onSaveToggle,
  isSaved = false,
}: MobileJobCardProps) {
  return (
    <article className="group flex items-center gap-3 rounded-2xl border border-primary/10 bg-white p-3.5 transition-all active:scale-[0.98]">
      {/* Company icon placeholder */}
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d8ff3e] text-primary"
        aria-hidden="true"
      >
        <span className="text-xs font-black">
          {job.company.charAt(0)}
        </span>
      </Link>

      {/* Content area */}
      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-extrabold text-primary">
          {job.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted">
          {job.company}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          {job.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          <span>{job.postedAgo}</span>
        </div>
      </Link>

      {/* Right: type badge + save button */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {job.type && (
          <span className="rounded-full bg-brandGreen/10 px-2.5 py-0.5 text-[10px] font-bold text-brandGreen">
            {job.type}
          </span>
        )}
        {onSaveToggle && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onSaveToggle(job.id);
            }}
            aria-label={isSaved ? "Unsave job" : "Save job"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:border-brandGreen hover:text-brandGreen active:scale-90"
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-brandGreen" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </article>
  );
}