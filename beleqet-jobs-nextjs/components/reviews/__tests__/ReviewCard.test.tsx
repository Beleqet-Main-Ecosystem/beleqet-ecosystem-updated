/**
 * @file ReviewCard.test.tsx
 * @description
 * Unit tests for ReviewCard component.
 * Tests review display, rating stars, reviewer info, and timestamp formatting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewCard } from '../ReviewCard';

describe('ReviewCard', () => {
  const mockProps = {
    reviewerName: 'John Doe',
    reviewerAvatar: 'https://example.com/avatar.jpg',
    rating: 5,
    comment: 'Excellent work! Very professional and delivered on time.',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    contractTitle: 'Web Development Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render review card with all information', () => {
      render(<ReviewCard {...mockProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Excellent work! Very professional and delivered on time.')).toBeInTheDocument();
      expect(screen.getByText('Web Development Project')).toBeInTheDocument();
    });

    it('should render without avatar when not provided', () => {
      const propsWithoutAvatar = { ...mockProps, reviewerAvatar: null };
      render(<ReviewCard {...propsWithoutAvatar} />);

      // Should show initial instead of avatar image
      expect(screen.getByText('J')).toBeInTheDocument();
      expect(screen.queryByAltText('John Doe')).not.toBeInTheDocument();
    });

    it('should render without contract title when not provided', () => {
      const propsWithoutContract = { ...mockProps, contractTitle: undefined };
      render(<ReviewCard {...propsWithoutContract} />);

      expect(screen.queryByText('Web Development Project')).not.toBeInTheDocument();
    });

    it('should render avatar image when provided', () => {
      render(<ReviewCard {...mockProps} />);

      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });
  });

  describe('rating display', () => {
    it('should display correct number of filled stars for 5-star rating', () => {
      render(<ReviewCard {...mockProps} rating={5} />);

      const stars = screen.getAllByTestId(/star/i);
      expect(stars).toHaveLength(5);
    });

    it('should display correct number of filled stars for 3-star rating', () => {
      render(<ReviewCard {...mockProps} rating={3} />);

      const stars = screen.getAllByTestId(/star/i);
      expect(stars).toHaveLength(5);
    });

    it('should display correct number of filled stars for 1-star rating', () => {
      render(<ReviewCard {...mockProps} rating={1} />);

      const stars = screen.getAllByTestId(/star/i);
      expect(stars).toHaveLength(5);
    });
  });

  describe('timestamp formatting', () => {
    it('should display relative time', () => {
      const recentDate = new Date();
      render(<ReviewCard {...mockProps} createdAt={recentDate} />);

      // Should show something like "less than a minute ago"
      const timeElement = screen.getByText(/ago/i);
      expect(timeElement).toBeInTheDocument();
    });

    it('should format older dates correctly', () => {
      const oldDate = new Date('2024-01-01T10:30:00Z');
      render(<ReviewCard {...mockProps} createdAt={oldDate} />);

      const timeElement = screen.getByText(/ago/i);
      expect(timeElement).toBeInTheDocument();
    });
  });

  describe('reviewer information', () => {
    it('should display reviewer name', () => {
      render(<ReviewCard {...mockProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display first letter of name as initial when no avatar', () => {
      const propsWithoutAvatar = { ...mockProps, reviewerAvatar: null };
      render(<ReviewCard {...propsWithoutAvatar} />);

      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should display contract title when provided', () => {
      render(<ReviewCard {...mockProps} contractTitle='Mobile App Development' />);

      expect(screen.getByText('Mobile App Development')).toBeInTheDocument();
    });
  });

  describe('comment display', () => {
    it('should display review comment', () => {
      render(<ReviewCard {...mockProps} />);

      expect(screen.getByText('Excellent work! Very professional and delivered on time.')).toBeInTheDocument();
    });

    it('should handle long comments', () => {
      const longComment = 'A'.repeat(500);
      render(<ReviewCard {...mockProps} comment={longComment} />);

      expect(screen.getByText(longComment)).toBeInTheDocument();
    });

    it('should handle empty comments', () => {
      render(<ReviewCard {...mockProps} comment='' />);

      const commentElement = screen.getByText('');
      expect(commentElement).toBeInTheDocument();
    });
  });

  describe('styling and classes', () => {
    it('should apply correct card styling classes', () => {
      const { container } = render(<ReviewCard {...mockProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('border');
    });

    it('should apply hover effect classes', () => {
      const { container } = render(<ReviewCard {...mockProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('transition-shadow');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in reviewer name', () => {
      render(<ReviewCard {...mockProps} reviewerName="José María García-López" />);

      expect(screen.getByText('José María García-Lopez')).toBeInTheDocument();
    });

    it('should handle special characters in comment', () => {
      render(<ReviewCard {...mockProps} comment="Great work! 👍 Would recommend 💯" />);

      expect(screen.getByText('Great work! 👍 Would recommend 💯')).toBeInTheDocument();
    });

    it('should handle very long reviewer names', () => {
      const longName = 'A'.repeat(100);
      render(<ReviewCard {...mockProps} reviewerName={longName} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });
  });
});
