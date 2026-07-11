import axios from "axios";
import { z } from "zod";
import { getToken } from "./auth";

// Zod schema for the reviewer sub-object returned by the API
const reviewerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable().optional(),
});

/** Zod schema for a single review record. */
export const reviewSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  reviewerId: z.string(),
  revieweeId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
  createdAt: z.string(),
  reviewer: reviewerSchema.optional(),
});

/** Zod schema for aggregate rating statistics. */
export const ratingStatsSchema = z.object({
  average: z.number(),
  count: z.number(),
});

/** A single review record as returned by the API. */
export type Review = z.infer<typeof reviewSchema>;

/** Aggregate rating statistics for a user. */
export type RatingStats = z.infer<typeof ratingStatsSchema>;

/** Payload required to create a new review. */
export interface CreateReviewPayload {
  /** ID of the completed contract being reviewed. */
  contractId: string;
  /** ID of the user receiving the review. */
  revieweeId: string;
  /** Integer star rating from 1 to 5. */
  rating: number;
  /** Optional written feedback, max 2 000 characters. */
  comment?: string;
}

// Shared axios instance — base URL from environment
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  timeout: 10_000,
});

/**
 * Submit a review for a completed contract.
 *
 * Requires the user to be authenticated. The stored JWT is attached
 * automatically via the `Authorization: Bearer` header.
 *
 * @param payload - Review data: contractId, revieweeId, rating, comment.
 * @returns The newly created `Review` record.
 * @throws `Error` with a human-readable message if the request fails.
 */
export async function submitReview(payload: CreateReviewPayload): Promise<Review> {
  const token = getToken();
  if (!token) throw new Error("You must be logged in to submit a review.");
  try {
    const { data } = await api.post("/reviews", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return reviewSchema.parse(data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.message;
      throw new Error(Array.isArray(msg) ? msg.join(", ") : msg ?? "Failed to submit review.");
    }
    throw new Error("Failed to submit review.");
  }
}

/**
 * Fetch all reviews received by a specific user.
 *
 * @param userId - The reviewee's user ID.
 * @returns Array of `Review` objects sorted newest first, or `[]` on error.
 */
export async function fetchReviews(userId: string): Promise<Review[]> {
  try {
    const { data } = await api.get(`/reviews/user/${userId}`);
    return z.array(reviewSchema).parse(data);
  } catch {
    return [];
  }
}

/**
 * Fetch aggregate rating statistics for a user.
 *
 * @param userId - The user whose stats to fetch.
 * @returns `{ average, count }`, or `{ average: 0, count: 0 }` on error.
 */
export async function fetchRatingStats(userId: string): Promise<RatingStats> {
  try {
    const { data } = await api.get(`/reviews/stats/${userId}`);
    return ratingStatsSchema.parse(data);
  } catch {
    return { average: 0, count: 0 };
  }
}

/**
 * Check whether the authenticated user has already reviewed a contract.
 *
 * @param contractId - The contract to query.
 * @returns The existing `Review` if found, or `null`.
 */
export async function fetchMyReviewForContract(contractId: string): Promise<Review | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const { data } = await api.get(`/reviews/contract/${contractId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!data) return null;
    return reviewSchema.parse(data);
  } catch {
    return null;
  }
}
