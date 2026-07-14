"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import StarRating from "@/components/StarRating";
import ReviewCard from "@/components/ReviewCard";
import { fetchReviews, fetchRatingStats, type Review, type RatingStats } from "@/lib/reviews";

/** Props accepted by the `ReviewList` component. */
interface ReviewListProps {
  /** ID of the user whose reviews should be displayed. */
  userId: string;
}

/**
 * Displays all reviews received by a user along with aggregate rating stats.
 *
 * Fetches data in parallel from `fetchReviews` and `fetchRatingStats`.
 * Handles three UI states: loading skeleton, empty state, and the full list.
 *
 * The aggregate block shows the numeric average, a readonly `StarRating`, and
 * the total review count. Each individual review is rendered as a `ReviewCard`.
 *
 * @param userId - The user whose reviews and stats to load.
 *
 * @example
 * <ReviewList userId="user-abc123" />
 */
export default function ReviewList({ userId }: ReviewListProps) {
  const t = useTranslations("reviews");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats>({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [r, s] = await Promise.all([fetchReviews(userId), fetchRatingStats(userId)]);
      if (!cancelled) { setReviews(r); setStats(s); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("loading")}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--color-border)]" />
        ))}
      </div>
    );
  }

  // Empty state
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">{t("noReviews")}</p>
      </div>
    );
  }

  return (
    <section aria-label={t("heading")}>
      {/* Aggregate stats block */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5">
        <div className="text-center">
          <p className="text-4xl font-black text-[var(--color-text)]">{stats.average.toFixed(1)}</p>
          <StarRating value={stats.average} readonly size="sm" className="mt-1" />
        </div>
        <div className="border-l border-[var(--color-border)] pl-4">
          <p className="text-sm font-semibold text-[var(--color-text)]">{t("basedOn", { count: stats.count })}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("verifiedReviews")}</p>
        </div>
      </div>

      {/* Individual review cards */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  );
}
