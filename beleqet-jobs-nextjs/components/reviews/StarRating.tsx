'use client';

/**
 * @file StarRating.tsx
 * @description
 * Interactive star rating component for selecting ratings from 1 to 5 stars.
 * Features hover effects, click selection, and visual feedback.
 *
 * Features:
 * - Interactive star selection with hover preview
 * - Smooth animations and transitions
 * - Accessible keyboard navigation
 * - Visual feedback for selected rating
 *
 * GDPR notes:
 *  - No personal data collected
 *  - Rating selection is user input for review submission
 */
import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StarRating component for interactive rating selection.
 *
 * @param rating - Current rating value (1-5)
 * @param onRatingChange - Callback when rating changes
 * @param readonly - If true, display only without interaction
 * @param size - Star size variant (default: 'md')
 */
export function StarRating({
  rating,
  onRatingChange,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleMouseEnter = (starValue: number) => {
    if (!readonly) {
      setHoverRating(starValue);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  const handleClick = (starValue: number) => {
    if (!readonly) {
      onRatingChange(starValue);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <button
          key={starValue}
          type="button"
          onClick={() => handleClick(starValue)}
          onMouseEnter={() => handleMouseEnter(starValue)}
          onMouseLeave={handleMouseLeave}
          disabled={readonly}
          className={`transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brandGreen focus:ring-offset-1 ${
            readonly ? 'cursor-default' : 'cursor-pointer'
          }`}
          aria-label={`Rate ${starValue} stars`}
          aria-pressed={rating >= starValue}
        >
          <Star
            className={`${sizeClasses[size]} ${
              starValue <= displayRating
                ? 'fill-orange-400 text-orange-400'
                : 'fill-gray-200 text-gray-300 dark:fill-gray-700 dark:text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
