/**
 * Shared enumerations for the Beleqet platform.
 *
 * These values mirror the Prisma schema enums exactly.
 * Any addition or rename here must be reflected in the backend schema.
 */

/** Platform user roles. */
export enum UserRole {
  ADMIN      = 'ADMIN',
  EMPLOYER   = 'EMPLOYER',
  JOB_SEEKER = 'JOB_SEEKER',
  FREELANCER = 'FREELANCER',
}

/** Employment type for a job listing. */
export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  REMOTE    = 'REMOTE',
  HYBRID    = 'HYBRID',
  CONTRACT  = 'CONTRACT',
}

/** Lifecycle status for a job listing. */
export enum JobStatus {
  DRAFT     = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED    = 'CLOSED',
  ARCHIVED  = 'ARCHIVED',
}

/** Lifecycle status for a job application. */
export enum ApplicationStatus {
  SUBMITTED            = 'SUBMITTED',
  SCREENING            = 'SCREENING',
  SHORTLISTED          = 'SHORTLISTED',
  INTERVIEW_SCHEDULED  = 'INTERVIEW_SCHEDULED',
  OFFERED              = 'OFFERED',
  REJECTED             = 'REJECTED',
  WITHDRAWN            = 'WITHDRAWN',
}

/** Lifecycle status for a freelance gig. */
export enum FreelanceJobStatus {
  DRAFT     = 'DRAFT',
  OPEN      = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Status of a bid/proposal on a freelance gig. */
export enum BidStatus {
  PENDING  = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/** Status of a freelance contract. */
export enum ContractStatus {
  ACTIVE    = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISPUTED  = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

/** Wallet transaction direction. */
export enum WalletTransactionType {
  CREDIT = 'CREDIT',
  DEBIT  = 'DEBIT',
}

/** Subscription billing cycle. */
export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY  = 'YEARLY',
}

/** Subscription lifecycle status. */
export enum SubscriptionStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED  = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING  = 'PENDING',
}

/** Payment provider. */
export enum PaymentProvider {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  CHAPA  = 'CHAPA',
}

/** User interface theme preference. */
export enum ThemePreference {
  LIGHT  = 'LIGHT',
  DARK   = 'DARK',
  SYSTEM = 'SYSTEM',
}
