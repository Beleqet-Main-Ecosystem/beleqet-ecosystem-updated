/**
 * @file ReviewForm.test.tsx
 * Jest unit + integration tests for components/ReviewForm.tsx
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

// ─── Mock lib/reviews ─────────────────────────────────────────────────────────
const mockSubmitReview = jest.fn();
jest.mock("@/lib/reviews", () => ({
  submitReview: (...args: any[]) => mockSubmitReview(...args),
}));

// ─── Mock lib/auth ────────────────────────────────────────────────────────────
jest.mock("@/lib/auth", () => ({ getToken: () => "mock-token" }));

import ReviewForm from "@/components/ReviewForm";

const DEFAULT_PROPS = {
  contractId: "contract-123",
  revieweeId: "user-xyz",
  revieweeName: "Abebe Girma",
};

function renderForm(props = DEFAULT_PROPS) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReviewForm {...props} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => { jest.clearAllMocks(); });

describe("ReviewForm", () => {
  test("renders the heading and reviewee name", () => {
    renderForm();
    expect(screen.getByText(en.reviews.writeReview)).toBeInTheDocument();
    expect(screen.getByText(/Abebe Girma/)).toBeInTheDocument();
  });

  test("renders 5 interactive star buttons", () => {
    renderForm();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  test("renders the comment textarea", () => {
    renderForm();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  test("renders the submit button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: en.reviews.submitReview })).toBeInTheDocument();
  });

  test("shows error when submitting without selecting a rating", async () => {
    renderForm();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.reviews.submitReview }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(en.reviews.errorSelectRating);
    expect(mockSubmitReview).not.toHaveBeenCalled();
  });

  test("calls submitReview with correct payload on valid submit", async () => {
    mockSubmitReview.mockResolvedValue({ id: "new-review" });
    renderForm();

    // Select 4 stars
    fireEvent.click(screen.getAllByRole("radio")[3]);

    // Type a comment
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Great work!" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.reviews.submitReview }));
    });

    expect(mockSubmitReview).toHaveBeenCalledWith({
      contractId: "contract-123",
      revieweeId: "user-xyz",
      rating: 4,
      comment: "Great work!",
    });
  });

  test("shows success state after successful submission", async () => {
    mockSubmitReview.mockResolvedValue({ id: "new-review" });
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[4]); // 5 stars

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.reviews.submitReview }));
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(en.reviews.submitted)).toBeInTheDocument();
    });
  });

  test("calls onSuccess callback after successful submission", async () => {
    mockSubmitReview.mockResolvedValue({ id: "new-review" });
    const onSuccess = jest.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ReviewForm {...DEFAULT_PROPS} onSuccess={onSuccess} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getAllByRole("radio")[2]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.reviews.submitReview }));
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("shows API error message on failure", async () => {
    mockSubmitReview.mockRejectedValue(new Error("Already reviewed."));
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[0]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.reviews.submitReview }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Already reviewed.");
    });
  });

  test("character counter updates as user types", () => {
    renderForm();
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByText("5/2000")).toBeInTheDocument();
  });
});
