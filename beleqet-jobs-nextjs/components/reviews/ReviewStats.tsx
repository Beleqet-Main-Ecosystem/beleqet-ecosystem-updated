'use client';

/**
 * @file ReviewStats.tsx
 * @description
 * Component displaying rating statistics including average rating, total reviews,
 * and rating distribution breakdown.
 *
 * Features:
 * - Displays average rating with visual star representation
 * - Shows total number of reviews
 * - Rating distribution bar chart (1-5 stars)
 * - Responsive design with dark mode support
 *
 * GDPR notes:
 *  - Only displays aggregated statistics (no individual PII)
 *  - Statistics are derived from user-submitted feedback
 */
import { Star } from 'lucide-react';

interface RatingDistribution {
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
}

interface ReviewStatsProps {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingDistribution;
}

/**
 * ReviewStats component for displaying rating statistics.
 *
 * @param averageRating - Average rating (0-5)
 * @param totalReviews - Total number of reviews
 * @param ratingDistribution - Distribution of ratings by star count
 */
export function ReviewStats({
  averageRating,
  totalReviews,
  ratingDistribution,
}: ReviewStatsProps) {
  const distribution = [
    { stars: 5, count: ratingDistribution.fiveStar, label: '5 stars' },
    { stars: 4, count: ratingDistribution.fourStar, label: '4 stars' },
    { stars: 3, count: ratingDistribution.threeStar, label: '3 stars' },
    { stars: 2, count: ratingDistribution.twoStar, label: '2 stars' },
    { stars: 1, count: ratingDistribution.oneStar, label: '1 star' },
  ];

  const getPercentage = (count: number) => {
    if (totalReviews === 0) return 0;
    return Math.round((count / totalReviews) * 100);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Average Rating */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-brandGreen/10">
          <span className="text-3xl font-bold text-brandGreen">{averageRating.toFixed(1)}</span>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(averageRating)
                    ? 'fill-orange-400 text-orange-400'
                    : 'fill-gray-200 text-gray-300 dark:fill-gray-700 dark:text-gray-600'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-3">
        {distribution.map((item) => (
          <div key={item.stars} className="flex items-center gap-3">
            <span className="w-20 text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-orange-400 transition-all duration-300"
                style={{ width: `${getPercentage(item.count)}%` }}
              />
            </div>
            <span className="w-12 text-sm text-gray-600 dark:text-gray-400 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {totalReviews === 0 && (
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No reviews yet
        </p>
      )}
    </div>
  );
}
