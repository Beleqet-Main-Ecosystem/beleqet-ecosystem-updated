/**
 * Wallet and transaction DTOs and response types.
 * Field names match the Prisma `FreelancerWallet`, `EmployerWallet`,
 * `WalletTransaction`, and `EmployerWalletTransaction` models.
 */

import { WalletTransactionType } from './enums';

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  note?: string | null;
  milestoneId?: string | null;
  externalTransactionId?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

/** Response from `GET /wallet` (freelancer). */
export interface FreelancerWallet {
  id: string;
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  updatedAt: string;
  transactions: WalletTransaction[];
}

export interface EmployerWalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  note?: string | null;
  escrowId?: string | null;
  createdAt: string;
}

/** Response from `GET /wallet/employer`. */
export interface EmployerWallet {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  updatedAt: string;
  transactions: EmployerWalletTransaction[];
}
