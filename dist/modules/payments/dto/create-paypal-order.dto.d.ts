export declare enum PaypalOrderIntent {
    CAPTURE = "CAPTURE",
    AUTHORIZE = "AUTHORIZE"
}
export declare class CreatePaypalOrderDto {
    amount: number;
    currency: string;
    userId: string;
    intent?: PaypalOrderIntent;
    description?: string;
    returnUrl?: string;
    cancelUrl?: string;
    subscriptionPlanId?: string;
    cycles?: number;
}
