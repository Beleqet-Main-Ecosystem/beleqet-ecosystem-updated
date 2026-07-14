import { TransactionStatus, TransactionType } from '@prisma/client';

/**
 * Domain entity representing a payment transaction.
 * Used for clean data transfer between layers.
 */
export class TransactionEntity {
  id: string;
  gatewayId: string;
  userId: string;
  amount: number;
  currency: string;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate?: number;
  exchangeRateSource?: string;
  providerTransactionId?: string;
  status: TransactionStatus;
  type: TransactionType;
  description?: string;
  metadata?: Record<string, unknown>;
  consentGiven: boolean;
  consentTimestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
