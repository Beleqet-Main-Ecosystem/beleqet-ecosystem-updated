"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import StarRating from "@/components/StarRating";
import { submitReview } from "@/lib/reviews";

/** Props accepted by the `ReviewForm` component. */
export interface ReviewFormProps {
  /** ID of the completed contract being reviewed. */
  contractId: string;
  /** ID of the user receiving the review. */
  revieweeId: string;
  /** Display name of the person being reviewed, shown in the form heading. */
  revieweeName: string;
  /** Optional callback invoked after the review is successfully submitted. */
  onSuccess?: () => void;
}

/**
 * Form that allows a client or freelancer to submit a review after a
 * contract has been completed.
 *
 * Features:
 * - Interactive star rating (keyboard + pointer, WCAG accessible).
 * - Optional written comment with a 2 000-character limit.
 * - Loading, error, and success states.
 * - All UI strings translated via `next-intl` (namespace: `reviews`).
 * - Calls `submitReview` from `lib/reviews.ts` on submission.
 *
 * @param contractId - The contract being reviewed.
 * @param revieweeId - The user who receives the review.
 * @param revieweeName - Displayed in the form sub-heading.
 * @param onSuccess - Called after a successful submission (e.g. to close a modal).
 *
 * @example
 * <ReviewForm
 *   contractId="abc-123"
 *   revieweeId="user-xyz"
 *   revieweeName="Abebe Girma"
 *   onSuccess={() => setOpen(false)}
 * />
 */
export default function ReviewForm({ contractId, revieweeId, revieweeName, onSuccess }: ReviewFormProps) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError(t("errorSelectRating")); return; }
    setError(null);
    setLoading(true);
    try {
      await submitReview({ contractId, revieweeId, rating, comment: comment.trim() || undefined });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  // Success state
  if (submitted) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 rounded-2xl border border-brandGreen/30 bg-brandGreen/5 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-brandGreen" aria-hidden="true" />
        <p className="text-base font-bold text-[var(--color-text)]">{t("submitted")}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{t("submittedSubtext")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6"
      aria-label={t("formAriaLabel", { name: revieweeName })}
    >
      {/* Heading */}
      <div>
        <h3 className="text-base font-extrabold text-[var(--color-text)]">{t("writeReview")}</h3>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("reviewingLabel", { name: revieweeName })}</p>
      </div>

      {/* Star rating */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          {t("rating")} <span className="text-redAccent" aria-hidden="true">*</span>
        </label>
        <StarRating value={rating} onChange={setRating} size="lg" label={t("rating")} />
        {rating > 0 && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t(`ratingLabel${rating}` as any)}</p>
        )}
      </div>

      {/* Comment textarea */}
      <div>
        <label htmlFor="review-comment" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          {t("comment")}{" "}
          <span className="font-normal text-[var(--color-text-muted)]">({t("optional")})</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("commentPlaceholder")}
          maxLength={2000}
          rows={4}
          className="w-full resize-none rounded-xl border px-3.5 py-3 text-sm outline-none bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-brandGreen"
        />
        <p className="mt-1 text-right text-xs text-[var(--color-text-muted)]">{comment.length}/2000</p>
      </div>

      {/* Validation / API error */}
      {error && (
        <p role="alert" aria-live="assertive" className="rounded-xl bg-redAccent/10 px-4 py-2.5 text-sm font-semibold text-redAccent">
          {error}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brandGreen px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-darkGreen disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen/50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? t("submitting") : t("submitReview")}
      </button>
    </form>
  );
}
