import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/webhook.dto';
import { StripePaymentIntentResult, StripeRefundResult, StripeWebhookEvent, SupportedCurrency } from './interfaces/payment.interfaces';
export declare class StripeService {
    private readonly config;
    private readonly prisma;
    private readonly logger;
    private readonly stripe;
    private readonly webhookSecret;
    constructor(config: ConfigService, prisma: PrismaService);
    createPaymentIntent(dto: CreatePaymentIntentDto): Promise<StripePaymentIntentResult>;
    confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<StripePaymentIntentResult>;
    refund(dto: CreateRefundDto): Promise<StripeRefundResult>;
    handleWebhook(rawBody: Buffer, signatureHeader: string): Promise<StripeWebhookEvent>;
    listSupportedCurrencies(): SupportedCurrency[];
    private processWebhookEvent;
    private validateCurrency;
    private sanitiseMetadata;
    private mapStripeStatusToDB;
    private upsertPaymentRecord;
    private updatePaymentStatusByProviderPaymentId;
    private updatePaymentStatus;
    private handleStripeError;
}
