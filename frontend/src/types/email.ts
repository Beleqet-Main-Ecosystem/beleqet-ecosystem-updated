export type EmailType =
  | 'WELCOME'
  | 'PASSWORD_RESET'
  | 'PAYMENT_RECEIPT'
  | 'NEWSLETTER';

export type EmailStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED' | 'BOUNCED';

export interface EmailLog {
  id: string;
  recipient: string;
  type: EmailType;
  status: EmailStatus;
  subject: string;
  locale: string;
  templateName: string;
  errorMessage: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailLogQuery {
  status?: EmailStatus;
  type?: EmailType;
  recipient?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface EmailLogPage {
  items: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
}
