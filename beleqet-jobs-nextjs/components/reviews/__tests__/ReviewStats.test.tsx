/**
 * @file ReviewStats.test.tsx
 * @description
 * Unit tests for ReviewStats component.
 * Tests rating statistics display, average rating, total reviews, and rating distribution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewStats } from '../ReviewStats';

describe('ReviewStats', () => {
  const mockProps = {
    averageRating: 4.5,
    totalReviews: 10,
    ratingDistribution: {
      fiveStar: 7,
      fourStar: 2,
      threeStar: 1,
      twoStar: 0,
      oneStar: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render review stats with all information', () => {
      render(<ReviewStats {...mockProps} />);

      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText('10 reviews')).toBeInTheDocument();
    });

    it('should render singular "review" when total is 1', () => {
      render(<ReviewStats {...mockProps} totalReviews={1} />);

      expect(screen.getByText('1 review')).toBeInTheDocument();
    });

    it('should render "No reviews yet" when total is 0', () => {
      render(<ReviewStats {...mockProps} totalReviews={0} averageRating={0} />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    });
  });

  describe('average rating display', () => {
    it('should display average rating with one decimal place', () => {
      render(<ReviewStats {...mockProps} averageRating={4.5} />);

      expect(screen.getByText('4.5')).toBeInTheDocument();
    });

    it('should display 0.0 when no reviews', () => {
      render(<ReviewStats {...mockProps} averageRating={0} totalReviews={0} />);

      expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('should display 5.0 for perfect rating', () => {
      render(<ReviewStats {...mockProps} averageRating={5} />);

      expect(screen.getByText('5.0')).toBeInTheDocument();
    });

    it('should display 1.0 for minimum rating', () => {
      render(<ReviewStats {...mockProps} averageRating={1} />);

      expect(screen.getByText('1.0')).toBeInTheDocument();
    });
  });

  describe('star rating visualization', () => {
    it('should display 5 stars', () => {
      render(<ReviewStats {...mockProps} />);

      const stars = screen.getAllByTestId(/star/i);
      expect(stars).toHaveLength(5);
    });

    it('should fill stars based on average rating', () => {
      render(<ReviewStats {...mockProps} averageRating={4.5} />);

      const stars = screen.getAllByTestId(/star/i);
      // 4.5 rounds to 5, so all 5 stars should be filled
      expect(stars).toHaveLength(5);
    });

    it('should fill correct number of stars for 3.0 rating', () => {
      render(<ReviewStats {...mockProps} averageRating={3} />);

      const stars = screen.getAllByTestId(/star/i);
      expect(stars).toHaveLength(5);
    });
  });

  describe('rating distribution', () => {
    it('should display all rating categories', () => {
      render(<ReviewStats {...mockProps} />);

      expect(screen.getByText('5 stars')).toBeInTheDocument();
      expect(screen.getByText('4 stars')).toBeInTheDocument();
      expect(screen.getByText('3 stars')).toBeInTheDocument();
      expect(screen.getByText('2 stars')).toBeInTheDocument();
      expect(screen.getByText('1 star')).toBeInTheDocument();
    });

    it('should display correct count for each rating', () => {
      render(<ReviewStats {...mockProps} />);

      expect(screen.getByText('7')).toBeInTheDocument(); // 5 stars
      expect(screen.getByText('2')).toBeInTheDocument(); // 4 stars
      expect(screen.getByText('1')).toBeInTheDocument(); // 3 stars
      expect(screen.getByText('0')).toBeInTheDocument(); // 2 stars
      expect(screen.getByText('0')).toBeInTheDocument(); // 1 star
    });

    it('should calculate correct percentage for distribution bars', () => {
      render(<ReviewStats {...mockProps} />);

      // 7 out of 10 = 70%
      const fiveStarBar = screen.getByText('7').closest('div')?.nextElementSibling;
      expect(fiveStarBar).toBeInTheDocument();
    });

    it('should handle zero counts in distribution', () => {
      const zeroDistribution = {
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      };

      render(<ReviewStats {...mockProps} ratingDistribution={zeroDistribution} totalReviews={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('total reviews display', () => {
    it('should display correct total reviews count', () => {
      render(<ReviewStats {...mockProps} totalReviews={25} />);

      expect(screen.getByText('25 reviews')).toBeInTheDocument();
    });

    it('should use singular form for 1 review', () => {
      render(<ReviewStats {...mockProps} totalReviews={1} />);

      expect(screen.getByText('1 review')).toBeInTheDocument();
      expect(screen.queryByText('1 reviews')).not.toBeInTheDocument();
    });

    it('should use plural form for 0 reviews', () => {
      render(<ReviewStats {...mockProps} totalReviews={0} />);

      expect(screen.getByText('0 reviews')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show "No reviews yet" when total is 0', () => {
      render(<ReviewStats {...mockProps} totalReviews={0} averageRating={0} />);

      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    });

    it('should show 0.0 average when no reviews', () => {
      render(<ReviewStats {...mockProps} totalReviews={0} averageRating={0} />);

      expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('should show all zeros in distribution when no reviews', () => {
      const emptyDistribution = {
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      };

      render(<ReviewStats {...mockProps} totalReviews={0} averageRating={0} ratingDistribution={emptyDistribution} />);

      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });
  });

  describe('styling and layout', () => {
    it('should apply correct card styling classes', () => {
      const { container } = render(<ReviewStats {...mockProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('border');
    });

    it('should display average rating in circular badge', () => {
      render(<ReviewStats {...mockProps} />);

      const ratingBadge = screen.getByText('4.5').closest('div');
      expect(ratingBadge).toHaveClass('rounded-full');
    });
  });

  describe('edge cases', () => {
    it('should handle very high review counts', () => {
      render(<ReviewStats {...mockProps} totalReviews={9999} />);

      expect(screen.getByText('9999 reviews')).toBeInTheDocument();
    });

    it('should handle decimal average ratings', () => {
      render(<ReviewStats {...mockProps} averageRating={3.7} />);

      expect(screen.getByText('3.7')).toBeInTheDocument();
    });

    it('should handle skewed distributions', () => {
      const skewedDistribution = {
        fiveStar: 100,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      };

      render(<ReviewStats {...mockProps} ratingDistribution={skewedDistribution} totalReviews={100} />);

      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should handle uniform distributions', () => {
      const uniformDistribution = {
        fiveStar: 2,
        fourStar: 2,
        threeStar: 2,
        twoStar: 2,
        oneStar: 2,
      };

      render(<ReviewStats {...mockProps} ratingDistribution={uniformDistribution} totalReviews={10} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });
});
