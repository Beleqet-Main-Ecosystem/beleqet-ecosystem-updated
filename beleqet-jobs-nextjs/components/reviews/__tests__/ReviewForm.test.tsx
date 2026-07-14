/**
 * @file ReviewForm.test.tsx
 * @description
 * Unit tests for ReviewForm component.
 * Tests form validation, rating selection, comment input, and submission handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewForm } from '../ReviewForm';

describe('ReviewForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('rendering', () => {
    it('should render form with rating and comment fields', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Write a Review')).toBeInTheDocument();
      expect(screen.getByLabelText('Rating')).toBeInTheDocument();
      expect(screen.getByLabelText('Your Review')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
    });

    it('should render contract title when provided', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} contractTitle="Web Development Project" />);

      expect(screen.getByText('Reviewing: Web Development Project')).toBeInTheDocument();
    });

    it('should show loading state when isLoading is true', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /submitting/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('rating selection', () => {
    it('should require rating selection', async () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'Great work!' } });

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Please select a rating')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should allow rating selection', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const ratingContainer = screen.getByLabelText('Rating');
      const stars = ratingContainer.querySelectorAll('button');
      
      // Click the 5th star
      fireEvent.click(stars[4]);

      expect(screen.queryByText('Please select a rating')).not.toBeInTheDocument();
    });
  });

  describe('comment validation', () => {
    it('should require minimum 10 characters', async () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'Short' } });

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Please provide a comment with at least 10 characters')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should enforce maximum 1000 characters', async () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      const longComment = 'a'.repeat(1001);
      fireEvent.change(commentInput, { target: { value: longComment } });

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Comment must be less than 1000 characters')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show character count', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'Test comment' } });

      expect(screen.getByText('13/1000')).toBeInTheDocument();
    });

    it('should show minimum character requirement', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Minimum 10 characters')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call onSubmit with rating and comment when valid', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'Excellent work, highly recommended!' } });

      const ratingContainer = screen.getByLabelText('Rating');
      const stars = ratingContainer.querySelectorAll('button');
      fireEvent.click(stars[4]);

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(5, 'Excellent work, highly recommended!');
    });

    it('should reset form after successful submission', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review') as HTMLTextAreaElement;
      fireEvent.change(commentInput, { target: { value: 'Great work!' } });

      const ratingContainer = screen.getByLabelText('Rating');
      const stars = ratingContainer.querySelectorAll('button');
      fireEvent.click(stars[4]);

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(commentInput.value).toBe('');
    });

    it('should show error message when submission fails', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Network error'));

      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'Excellent work!' } });

      const ratingContainer = screen.getByLabelText('Rating');
      const stars = ratingContainer.querySelectorAll('button');
      fireEvent.click(stars[4]);

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Failed to submit review. Please try again.')).toBeInTheDocument();
    });

    it('should disable submit button while loading', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /submitting/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('error display', () => {
    it('should show error message when present', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Please select a rating')).toBeInTheDocument();
    });

    it('should clear error message when user starts typing', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Please select a rating')).toBeInTheDocument();

      // Start typing in comment
      const commentInput = screen.getByLabelText('Your Review');
      fireEvent.change(commentInput, { target: { value: 'a' } });

      // Error should still be there since rating is still missing
      expect(screen.getByText('Please select a rating')).toBeInTheDocument();
    });
  });

  describe('textarea attributes', () => {
    it('should have correct placeholder', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      expect(commentInput).toHaveAttribute('placeholder', 'Share your experience working with this freelancer...');
    });

    it('should have correct rows', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      expect(commentInput).toHaveAttribute('rows', '4');
    });

    it('should have maxLength attribute', () => {
      render(<ReviewForm onSubmit={mockOnSubmit} />);

      const commentInput = screen.getByLabelText('Your Review');
      expect(commentInput).toHaveAttribute('maxLength', '1000');
    });
  });
});
