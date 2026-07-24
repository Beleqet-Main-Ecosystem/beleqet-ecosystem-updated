/**
 * Unit tests for the Fraud Alert ResolveForm component.
 * Tests that the resolve buttons render, call the API, and handle error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';

const mockResolveFraudAlert = vi.fn();
const mockGetFraudAlert = vi.fn();
const mockUseParams = vi.fn();

vi.mock('@/lib/api', () => ({
  getFraudAlert: (...args: unknown[]) => mockGetFraudAlert(...args),
  resolveFraudAlert: (...args: unknown[]) => mockResolveFraudAlert(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

describe('FraudAlertDetailPage (resolve form)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'alert-test-123' });
  });

  it('should display resolve buttons for OPEN alerts', async () => {
    mockGetFraudAlert.mockResolvedValue({
      alert: {
        id: 'alert-test-123',
        entityType: 'User',
        entityId: 'user-1',
        ruleType: 'FAKE_PROFILE',
        severity: 'HIGH',
        score: 80,
        reason: 'Fake profile detected',
        status: 'OPEN',
        evidence: null,
        currency: 'ETB',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'u1',
        ruleId: 'r1',
        resolvedById: null,
        resolvedAt: null,
        resolutionNote: null,
        metadata: null,
      },
      context: {},
    });

    const { default: FraudAlertDetailPage } = await import(
      '@/app/admin/fraud/[id]/page'
    );

    await act(async () => {
      render(<FraudAlertDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Mark Resolved')).toBeTruthy();
      expect(screen.getByText('Mark False Positive')).toBeTruthy();
      expect(screen.getByText('Confirm Fraud')).toBeTruthy();
    });
  });

  it('should call resolveFraudAlert with RESOLVED when button clicked', async () => {
    mockGetFraudAlert.mockResolvedValue({
      alert: {
        id: 'alert-test-123',
        entityType: 'User',
        entityId: 'user-1',
        ruleType: 'FAKE_PROFILE',
        severity: 'HIGH',
        score: 80,
        reason: 'Fake profile detected',
        status: 'OPEN',
        evidence: null,
        currency: 'ETB',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'u1',
        ruleId: 'r1',
        resolvedById: null,
        resolvedAt: null,
        resolutionNote: null,
        metadata: null,
      },
      context: {},
    });

    mockResolveFraudAlert.mockResolvedValue({
      resolved: true,
      alert: {
        id: 'alert-test-123',
        status: 'RESOLVED',
        resolutionNote: 'All good',
        resolvedAt: new Date().toISOString(),
      },
    });

    const { default: FraudAlertDetailPage } = await import(
      '@/app/admin/fraud/[id]/page'
    );

    await act(async () => {
      render(<FraudAlertDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Mark Resolved')).toBeTruthy();
    });

    const textarea = screen.getByPlaceholderText(/resolution note/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'All good' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Mark Resolved'));
    });

    await waitFor(() => {
      expect(mockResolveFraudAlert).toHaveBeenCalledWith('alert-test-123', {
        status: 'RESOLVED',
        resolutionNote: 'All good',
      });
    });
  });

  it('should display error message when API fails', async () => {
    mockGetFraudAlert.mockRejectedValue(new Error('Network error'));

    const { default: FraudAlertDetailPage } = await import(
      '@/app/admin/fraud/[id]/page'
    );

    await act(async () => {
      render(<FraudAlertDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Alert not found or error/i)).toBeTruthy();
    });
  });
});
