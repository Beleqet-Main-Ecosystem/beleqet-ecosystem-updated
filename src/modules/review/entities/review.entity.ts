/**
 * Domain entity representing a single freelancer review.
 * Maps to the `Review` Prisma model.
 */
export class Review {
  id: string;
  freelancerId: string;
  customerId: string;
  rating: number;
  comment: string;
  locale: string;
  transactionCurrency: string;
  gdprConsentGiven: boolean;
  isAnonymized: boolean;
  createdAt: string;
  updatedAt: string;
}
