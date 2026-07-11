/**
 * @file ReviewCard.test.tsx
 * Jest unit tests for components/ReviewCard.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ReviewCard from "@/components/ReviewCard";
import type { Review } from "@/lib/reviews";

const baseReview: Review = {
  id: "review-1",
  contractId: "contract-abc",
  reviewerId: "user-1",
  revieweeId: "user-2",
  rating: 4,
  comment: "Excellent collaboration.",
  createdAt: "2025-01-15T10:00:00Z",
  reviewer: {
    id: "user-1",
    firstName: "Abebe",
    lastName: "Girma",
    avatarUrl: null,
  },
};

function renderCard(review: Review = baseReview) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReviewCard review={review} />
    </NextIntlClientProvider>
  );
}

describe("ReviewCard", () => {
  test("renders reviewer full name", () => {
    renderCard();
    expect(screen.getByText("Abebe Girma")).toBeInTheDocument();
  });

  test("renders the comment text", () => {
    renderCard();
    expect(screen.getByText("Excellent collaboration.")).toBeInTheDocument();
  });

  test("renders a formatted date", () => {
    renderCard();
    // Date rendered — check year at minimum
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  test("renders the star rating with correct aria-label", () => {
    renderCard();
    expect(screen.getByRole("img", { name: /4\.0 out of 5 stars/i })).toBeInTheDocument();
  });

  test("renders 'Anonymous' when reviewer is missing", () => {
    renderCard({ ...baseReview, reviewer: undefined });
    expect(screen.getByText(en.reviews.anonymousReviewer)).toBeInTheDocument();
  });

  test("does not render comment section when comment is null", () => {
    renderCard({ ...baseReview, comment: null });
    expect(screen.queryByText("Excellent collaboration.")).not.toBeInTheDocument();
  });

  test("renders reviewer avatar when avatarUrl is provided", () => {
    renderCard({
      ...baseReview,
      reviewer: { ...baseReview.reviewer!, avatarUrl: "https://example.com/avatar.jpg" },
    });
    const img = screen.getByRole("img", { name: "Abebe Girma" });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  test("renders fallback icon when avatarUrl is null", () => {
    renderCard(); // avatarUrl is null in baseReview
    // Should render the User icon placeholder span, no img for avatar
    const imgs = screen.queryAllByRole("img", { name: "Abebe Girma" });
    expect(imgs).toHaveLength(0);
  });

  test("has correct article landmark", () => {
    renderCard();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
