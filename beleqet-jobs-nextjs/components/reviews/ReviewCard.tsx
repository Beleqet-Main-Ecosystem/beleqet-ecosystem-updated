'use client';

/**
 * @file ReviewCard.tsx
 * @description
 * Individual review card component displaying reviewer details, rating, comment, and date.
 * Used in review lists to show individual feedback entries.
 *
 * Features:
 * - Displays reviewer name and avatar
 * - Shows star rating (read-only)
 * - Displays review comment and date
 * - Responsive design with dark mode support
 *
 * GDPR notes:
 *  - Only displays user-submitted feedback (consented via platform terms)
 *  - No additional PII beyond what users agreed to share
 */
import { Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ReviewCardProps {
  reviewerName: string;
  reviewerAvatar?: string | null;
  rating: number;
  comment: string;
  createdAt: Date;
  contractTitle?: string;
}

/**
 * ReviewCard component for displaying individual reviews.
 *
 * @param reviewerName - Name of the person who wrote the review
 * @param reviewerAvatar - Optional avatar URL of the reviewer
 * @param rating - Star rating (1-5)
 * @param comment - Review text/comment
 * @param createdAt - Date when the review was created
 * @param contractTitle - Optional title of the associated contract/job
 */
export function ReviewCard({
  reviewerName,
  reviewerAvatar,
  rating,
  comment,
  createdAt,
  contractTitle,
}: ReviewCardProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Header: Reviewer info and rating */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {reviewerAvatar ? (
            <img
              src={reviewerAvatar}
              alt={reviewerName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
              <span className="text-sm font-semibold">
                {reviewerName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{reviewerName}</p>
            {contractTitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{contractTitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= rating
                  ? 'fill-orange-400 text-orange-400'
                  : 'fill-gray-200 text-gray-300 dark:fill-gray-700 dark:text-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Review comment */}
      <p className="mb-3 text-gray-700 dark:text-gray-300">{comment}</p>

      {/* Timestamp */}
      <p className="text-xs text-gray-400 dark:text-gray-500">{timeAgo}</p>
    </div>
  );
}
