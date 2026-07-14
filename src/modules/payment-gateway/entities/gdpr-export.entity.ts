import { TransactionEntity } from './transaction.entity';

/**
 * Entity for GDPR data export (Right to Access).
 * Contains all user payment data in a portable format.
 */
export class PaymentDataExportEntity {
  userId: string;
  exportedAt: string;
  totalTransactions: number;
  totalAmountPaid: Record<string, number>;
  totalAmountRefunded: Record<string, number>;
  transactions: TransactionEntity[];
 consentHistory?: Array<Record<string, unknown>>;
}
