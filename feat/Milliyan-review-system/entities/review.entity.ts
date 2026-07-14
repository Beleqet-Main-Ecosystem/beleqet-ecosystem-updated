/**
 * Domain entity representing a single freelancer review.
 *
 * This is deliberately kept persistence-agnostic (no TypeORM/Mongoose
 * decorators) so the module can be wired to any storage engine through
 * the {@link IReviewRepository} abstraction, per the Dependency
 * Inversion Principle.
 */
export class Review {
  /** Unique identifier (UUID v4) of the review. */
  id: string;

  /** UUID of the freelancer being reviewed. */
  freelancerId: string;

  /** UUID of the customer submitting the review. */
  customerId: string;

  /** Star rating from 1 to 5 (inclusive). */
  rating: number;

  /** Free-text written feedback, sanitized on write. */
  comment: string;

  /**
   * BCP-47 locale tag of the reviewer (e.g. "en-US", "ar-EG").
   * Required for i18n-aware rendering and moderation.
   */
  locale: string;

  /**
   * ISO 4217 currency code of the underlying transaction the review
   * relates to (e.g. "USD", "EUR"). Stored for audit/context only —
   * the Review System does not perform currency conversion itself.
   */
  transactionCurrency: string;

  /**
   * GDPR consent flag captured at submission time. A review must not
   * be persisted without explicit consent from the customer.
   */
  gdprConsentGiven: boolean;

  /** Soft-delete / anonymization flag used to satisfy GDPR erasure requests. */
  isAnonymized: boolean;

  /** Creation timestamp (UTC, ISO-8601). */
  createdAt: string;

  /** Last update timestamp (UTC, ISO-8601). */
  updatedAt: string;
}
