export interface StripePaymentIntentResult {
    id: string;
    clientSecret: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
}
export interface StripeRefundResult {
    id: string;
    status: string;
    amount: number;
    currency: string;
    paymentIntentId: string;
    createdAt: string;
}
export interface SupportedCurrency {
    code: string;
    minimumAmount: number;
    zeroDecimal: boolean;
}
export interface StripeWebhookEvent {
    id: string;
    type: string;
    data: {
        object: Record<string, unknown>;
    };
    created: number;
    livemode: boolean;
}
export interface PaypalOrderResult {
    id: string;
    status: string;
    approvalUrl: string | null;
    amount: string;
    currency: string;
    createdAt: string;
}
export interface PaypalCaptureResult {
    orderId: string;
    status: string;
    captureId: string | null;
    capturedAt: string;
}
export interface PaypalSubscriptionResult {
    id: string;
    status: string;
    approvalUrl: string | null;
    planId: string;
    createdAt: string;
}
export interface PaypalWebhookEvent {
    id: string;
    event_type: string;
    resource_type: string;
    summary: string;
    resource: Record<string, unknown>;
    create_time: string;
}
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
export type PaymentProvider = 'STRIPE' | 'PAYPAL';
export interface PaymentRecord {
    id: string;
    userId: string;
    provider: PaymentProvider;
    providerPaymentId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string | null;
    metadata: Record<string, unknown> | null;
    refundedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
