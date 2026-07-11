"use client";

import { useTranslations } from "next-intl";
import { User } from "lucide-react";
import StarRating from "@/components/StarRating";
import type { Review } from "@/lib/reviews";

/** Props accepted by the `ReviewCard` component. */
interface ReviewCardProps {
  /** The review data to display. */
  review: Review;
}

/**
 * Displays a single review entry.
 *
 * Shows the reviewer's avatar (or a fallback icon), full name, formatted date,
 * star rating, and optional written comment. Used inside `ReviewList`.
 *
 * Falls back to the translated string `reviews.anonymousReviewer` when
 * reviewer data is missing from the API response.
 *
 * @param review - The review object returned by the API.
 *
 * @example
 * <ReviewCard review={review} />
 */
export default function ReviewCard({ review }: ReviewCardProps) {
  const t = useTranslations("reviews");

  const reviewerName = review.reviewer
    ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
    : t("anonymousReviewer");

  const formattedDate = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5"
      aria-label={`Review by ${reviewerName}`}
    >
      {/* Header: avatar, name, date, star rating */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {review.reviewer?.avatarUrl ? (
            <img
              src={review.reviewer.avatarUrl}
              alt={reviewerName}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
              <User className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">{reviewerName}</p>
            <time dateTime={review.createdAt} className="text-xs text-[var(--color-text-muted)]">
              {formattedDate}
            </time>
          </div>
        </div>
        <StarRating value={review.rating} readonly size="sm" />
      </div>

      {/* Optional written comment */}
      {review.comment && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {review.comment}
        </p>
      )}
    </article>
  );
}
