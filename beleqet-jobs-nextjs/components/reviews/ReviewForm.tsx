'use client';

/**
 * @file ReviewForm.tsx
 * @description
 * Form component for submitting new reviews.
 * Includes star rating selection and text comment input with validation.
 *
 * Features:
 * - Interactive star rating selection
 * - Text area for review comments
 * - Form validation
 * - Loading state during submission
 * - Error handling and display
 * - i18n support for English and Amharic
 *
 * GDPR notes:
 *  - Only submits user-provided feedback (consented via platform terms)
 *  - No additional PII collected beyond what user provides
 */
import { useState } from 'react';
import { StarRating } from './StarRating';
import { getReviewTranslation } from '@/lib/i18n/translations';

interface ReviewFormProps {
  onSubmit: (rating: number, comment: string) => Promise<void>;
  isLoading?: boolean;
  contractTitle?: string;
}

/**
 * ReviewForm component for submitting new reviews.
 *
 * @param onSubmit - Callback function to handle form submission
 * @param isLoading - Loading state for the submit button
 * @param contractTitle - Optional title of the contract being reviewed
 */
export function ReviewForm({ onSubmit, isLoading = false, contractTitle }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  // Default to English, can be extended to use user's language preference
  const lang = 'en';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (rating === 0) {
      setError(getReviewTranslation(lang, 'selectRating'));
      return;
    }
    if (comment.trim().length < 10) {
      setError(getReviewTranslation(lang, 'commentTooShort'));
      return;
    }
    if (comment.trim().length > 1000) {
      setError(getReviewTranslation(lang, 'commentTooLong'));
      return;
    }

    try {
      await onSubmit(rating, comment.trim());
      // Reset form on success
      setRating(0);
      setComment('');
    } catch (err) {
      setError(getReviewTranslation(lang, 'submissionFailed'));
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {getReviewTranslation(lang, 'writeReview')}
      </h3>
      {contractTitle && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {getReviewTranslation(lang, 'reviewing')} {contractTitle}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {getReviewTranslation(lang, 'rating')} <span className="text-red-500">*</span>
          </label>
          <StarRating rating={rating} onRatingChange={setRating} size="lg" />
        </div>

        {/* Comment */}
        <div>
          <label htmlFor="comment" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {getReviewTranslation(lang, 'yourReview')} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={getReviewTranslation(lang, 'placeholder')}
            rows={4}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brandGreen focus:outline-none focus:ring-2 focus:ring-brandGreen/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-brandGreen dark:focus:ring-brandGreen/20"
            disabled={isLoading}
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{getReviewTranslation(lang, 'minimumChars')}</span>
            <span>{comment.length}/1000</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-brandGreen px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brandGreen/90 focus:outline-none focus:ring-2 focus:ring-brandGreen focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900"
        >
          {isLoading ? getReviewTranslation(lang, 'submitting') : getReviewTranslation(lang, 'submitReview')}
        </button>
      </form>
    </div>
  );
}
