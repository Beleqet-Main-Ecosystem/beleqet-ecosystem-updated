export declare enum StripePaymentMethod {
    CARD = "card",
    SEPA_DEBIT = "sepa_debit",
    KLARNA = "klarna",
    IDEAL = "ideal",
    AFTERPAY = "afterpay_clearpay",
    PAYPAL = "paypal"
}
export declare class CreatePaymentIntentDto {
    amount: number;
    currency: string;
    userId: string;
    description?: string;
    paymentMethodType?: StripePaymentMethod;
    metadata?: Record<string, string>;
}
