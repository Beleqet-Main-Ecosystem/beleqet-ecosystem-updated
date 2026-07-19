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
