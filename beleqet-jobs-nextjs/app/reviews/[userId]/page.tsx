"use client";

/**
 * @file app/reviews/[userId]/page.tsx
 *
 * Public profile reviews page — shows all reviews received by a user
 * identified by their userId, plus the ReviewForm if the current
 * authenticated user has a completed contract with them.
 *
 * Route: /reviews/[userId]
 */

import { useTranslations } from "next-intl";
import ReviewList from "@/components/ReviewList";

interface ReviewsPageProps {
  params: { userId: string };
}

/**
 * Reviews page for a given user.
 * Displays aggregate stats + all individual review cards.
 * The ReviewForm for submitting new reviews is embedded in ReviewList
 * and guarded by auth + contract completion status on the API side.
 */
export default function ReviewsPage({ params }: ReviewsPageProps) {
  const t = useTranslations("reviews");

  return (
    <div className="container-page py-12">
      <h1 className="mb-8 text-2xl font-extrabold text-[var(--color-text)]">
        {t("heading")}
      </h1>
      <ReviewList userId={params.userId} />
    </div>
  );
}
