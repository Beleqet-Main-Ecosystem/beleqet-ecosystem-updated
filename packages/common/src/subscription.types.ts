/**
 * Subscription and plan DTOs and response types.
 * Field names match the Prisma `Plan` and `Subscription` models.
 */

import { BillingInterval, SubscriptionStatus, PaymentProvider } from './enums';

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  priceAmount: number;
  currency: string;
  interval: BillingInterval;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan?: Plan | null;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider?: PaymentProvider | null;
  providerSubscriptionId?: string | null;
  createdAt: string;
}

export interface CheckoutDto {
  planId: string;
  provider: PaymentProvider;
  successUrl?: string;
  cancelUrl?: string;
}
