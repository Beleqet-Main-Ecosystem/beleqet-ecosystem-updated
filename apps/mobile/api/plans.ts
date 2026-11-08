/** Employer plans: what's on offer, the current subscription, Chapa checkout and bank transfer. */
import { get, send, upload, type PickedFile } from '../lib/api';

/** Prices are kept in santim (1/100 birr), like the website and API. */
export type Plan = {
  id: string;
  name: string;
  priceAmount: number;
  currency: string;
  interval?: string;
  isActive?: boolean;
  features?: { maxJobPosts?: number | null; [key: string]: unknown } | null;
  description?: string | null;
};

export type Subscription = {
  id: string;
  planId?: string;
  provider?: string | null;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  plan?: { name?: string; priceAmount?: number; currency?: string; features?: { maxJobPosts?: number } } | null;
};

export const fetchPlans = () => get<Plan[]>('/plans');
/** The API answers with an empty body when there is no subscription. */
export const fetchSubscription = async () => ((await get<Subscription | '' | null>('/subscriptions/me')) || null) as Subscription | null;
export const cancelSubscription = (id: string) => send('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`);

/** Opens a Chapa checkout for one period of a plan; poll the payment until Chapa confirms it. */
export const checkoutPlan = (planId: string) => send<{ paymentId?: string; checkoutUrl?: string }>('POST', '/subscriptions/checkout', { planId, method: 'CHAPA' });
export const fetchPlanPayment = (paymentId: string) => get<{ status: string }>(`/subscriptions/payments/${encodeURIComponent(paymentId)}`);

export type ManualPayment = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  transactionReference: string | null;
  metadata?: { planId?: string } | null;
  createdAt: string;
};

export const fetchManualPayments = () => get<ManualPayment[]>('/manual-payment/mine');
export const startManualPayment = (planId: string) => send<ManualPayment>('POST', '/manual-payment', { planId });
export const sendReceipt = (paymentId: string, transactionReference: string, receipt: PickedFile) =>
  upload('/manual-payment/submit-receipt', receipt, { paymentId, transactionReference }, 'receipt');

/** "ETB 1,500" from santim. */
export const planMoney = (amount: number, currency = 'ETB') => `${currency} ${(amount / 100).toLocaleString('en-US')}`;
