export type ChapaInitializeRequest = {
  amount: string;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  txRef: string;
  callbackUrl?: string;
  returnUrl?: string;
  title: string;
  description: string;
};

export type ChapaInitializeResponse = {
  status: string;
  message?: string;
  data?: {
    checkout_url?: string;
    reference?: string;
  };
};

export type ChapaVerifyResponse = {
  status: string;
  message?: string;
  data?: {
    tx_ref?: string;
    reference?: string;
    status?: string;
    amount?: string | number;
    currency?: string;
  };
};

export type ChapaPaymentResult = {
  state: 'success' | 'pending' | 'failed';
  /** Birr as Chapa reports it; NaN when Chapa sent none. */
  amount: number;
  currency: string;
  raw: ChapaVerifyResponse;
};

/** A bank or wallet Chapa can pay out to; `code` is what transfers take as `bank_code`. */
export type ChapaBank = {
  code: string;
  name: string;
  /** Digits in an account (or phone) number there, when Chapa says. */
  accountLength: number | null;
  mobileMoney: boolean;
};

export type ChapaBanksResponse = {
  status?: string;
  message?: string;
  data?: Array<{
    id: number | string;
    name: string;
    acct_length?: number | null;
    is_mobilemoney?: number | boolean | null;
    active?: number | boolean | null;
    currency?: string | null;
  }>;
};

export type ChapaTransferRequest = {
  accountName: string;
  accountNumber: string;
  amount: string;
  currency: string;
  reference: string;
  bankCode: string;
};

export type ChapaTransferResponse = {
  status: string;
  message?: string;
  data?: {
    reference?: string;
    amount?: string | number;
    currency?: string;
    status?: string;
    [key: string]: unknown;
  };
};

export type ChapaWebhookPayload = {
  event?: string;
  type?: string;
  reference?: string;
  tx_ref?: string;
  trx_ref?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  [key: string]: unknown;
};
