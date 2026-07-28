import { Request } from 'express';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreatePaypalOrderDto } from './dto/create-paypal-order.dto';
import { CreateRefundDto, CapturePaypalOrderDto } from './dto/webhook.dto';
export declare class StripeController {
    private readonly stripeService;
    constructor(stripeService: StripeService);
    createPaymentIntent(dto: CreatePaymentIntentDto): Promise<import("./interfaces/payment.interfaces").StripePaymentIntentResult>;
    confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<import("./interfaces/payment.interfaces").StripePaymentIntentResult>;
    refund(dto: CreateRefundDto): Promise<import("./interfaces/payment.interfaces").StripeRefundResult>;
    listSupportedCurrencies(): import("./interfaces/payment.interfaces").SupportedCurrency[];
}
export declare class StripeWebhookController {
    private readonly stripeService;
    constructor(stripeService: StripeService);
    handleWebhook(req: Request & {
        rawBody?: Buffer;
    }, signature: string): Promise<import("./interfaces/payment.interfaces").StripeWebhookEvent>;
}
export declare class PaypalController {
    private readonly paypalService;
    constructor(paypalService: PaypalService);
    createOrder(dto: CreatePaypalOrderDto): Promise<import("./interfaces/payment.interfaces").PaypalOrderResult>;
    captureOrder(dto: CapturePaypalOrderDto, payerId: string): Promise<import("./interfaces/payment.interfaces").PaypalCaptureResult>;
    createSubscription(dto: CreatePaypalOrderDto): Promise<import("./interfaces/payment.interfaces").PaypalSubscriptionResult>;
}
export declare class PaypalWebhookController {
    private readonly paypalService;
    constructor(paypalService: PaypalService);
    handleWebhook(body: unknown, req: Request): Promise<import("./interfaces/payment.interfaces").PaypalWebhookEvent>;
}
