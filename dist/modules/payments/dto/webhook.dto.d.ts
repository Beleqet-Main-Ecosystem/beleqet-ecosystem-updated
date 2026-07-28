export declare class StripeWebhookDto {
    stripeSignature: string;
}
export declare class PaypalWebhookDto {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
}
export declare class CreateRefundDto {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
}
export declare class CapturePaypalOrderDto {
    orderId: string;
}
