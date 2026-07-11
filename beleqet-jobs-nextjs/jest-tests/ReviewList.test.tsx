/**
 * @file ReviewList.test.tsx
 * Jest unit + integration tests for components/ReviewList.tsx
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Review, RatingStats } from "@/lib/reviews";

// ─── Mock lib/reviews ─────────────────────────────────────────────────────────
const mockFetchReviews = jest.fn();
const mockFetchRatingStats = jest.fn();

jest.mock("@/lib/reviews", () => ({
  fetchReviews: (...args: any[]) => mockFetchReviews(...args),
  fetchRatingStats: (...args: any[]) => mockFetchRatingStats(...args),
}));

import ReviewList from "@/components/ReviewList";

const USER_ID = "user-abc";

const sampleReviews: Review[] = [
  {
    id: "r1",
    contractId: "c1",
    reviewerId: "reviewer-1",
    revieweeId: USER_ID,
    rating: 5,
    comment: "Outstanding!",
    createdAt: "2025-03-01T00:00:00Z",
    reviewer: { id: "reviewer-1", firstName: "Sara", lastName: "Bekele", avatarUrl: null },
  },
  {
    id: "r2",
    contractId: "c2",
    reviewerId: "reviewer-2",
    revieweeId: USER_ID,
    rating: 4,
    comment: "Good work.",
    createdAt: "2025-02-15T00:00:00Z",
    reviewer: { id: "reviewer-2", firstName: "Haile", lastName: "Selassie", avatarUrl: null },
  },
];

const sampleStats: RatingStats = { average: 4.5, count: 2 };

function renderList(userId = USER_ID) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReviewList userId={userId} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => { jest.clearAllMocks(); });

describe("ReviewList", () => {
  test("shows loading skeleton while fetching", async () => {
    // Never resolves during this test
    mockFetchReviews.mockReturnValue(new Promise(() => {}));
    mockFetchRatingStats.mockReturnValue(new Promise(() => {}));

    const { container } = renderList();
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("shows empty state when no reviews exist", async () => {
    mockFetchReviews.mockResolvedValue([]);
    mockFetchRatingStats.mockResolvedValue({ average: 0, count: 0 });

    await act(async () => { renderList(); });

    await waitFor(() => {
      expect(screen.getByText(en.reviews.noReviews)).toBeInTheDocument();
    });
  });

  test("renders aggregate stats when reviews exist", async () => {
    mockFetchReviews.mockResolvedValue(sampleReviews);
    mockFetchRatingStats.mockResolvedValue(sampleStats);

    await act(async () => { renderList(); });

    await waitFor(() => {
      expect(screen.getByText("4.5")).toBeInTheDocument();
    });
  });

  test("renders a ReviewCard for each review", async () => {
    mockFetchReviews.mockResolvedValue(sampleReviews);
    mockFetchRatingStats.mockResolvedValue(sampleStats);

    await act(async () => { renderList(); });

    await waitFor(() => {
      expect(screen.getByText("Outstanding!")).toBeInTheDocument();
      expect(screen.getByText("Good work.")).toBeInTheDocument();
    });
  });

  test("renders reviewer names", async () => {
    mockFetchReviews.mockResolvedValue(sampleReviews);
    mockFetchRatingStats.mockResolvedValue(sampleStats);

    await act(async () => { renderList(); });

    await waitFor(() => {
      expect(screen.getByText("Sara Bekele")).toBeInTheDocument();
      expect(screen.getByText("Haile Selassie")).toBeInTheDocument();
    });
  });

  test("calls fetchReviews and fetchRatingStats with the userId", async () => {
    mockFetchReviews.mockResolvedValue([]);
    mockFetchRatingStats.mockResolvedValue({ average: 0, count: 0 });

    await act(async () => { renderList("specific-user"); });

    expect(mockFetchReviews).toHaveBeenCalledWith("specific-user");
    expect(mockFetchRatingStats).toHaveBeenCalledWith("specific-user");
  });

  test("renders 'verified reviews' label in stats area", async () => {
    mockFetchReviews.mockResolvedValue(sampleReviews);
    mockFetchRatingStats.mockResolvedValue(sampleStats);

    await act(async () => { renderList(); });

    await waitFor(() => {
      expect(screen.getByText(en.reviews.verifiedReviews)).toBeInTheDocument();
    });
  });
});
