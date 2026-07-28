import { PrismaService } from '../../prisma/prisma.service';
import { PaypalService } from '../payments/paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './dto/checkout.dto';
export declare class SubscriptionsCheckoutService {
    private readonly prisma;
    private readonly paypalService;
    private readonly subscriptionsService;
    constructor(prisma: PrismaService, paypalService: PaypalService, subscriptionsService: SubscriptionsService);
    checkout(userId: string, dto: CheckoutDto): Promise<{
        subscription: {
            id: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            userId: string;
            updatedAt: Date;
            provider: import(".prisma/client").$Enums.PaymentProvider | null;
            planId: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean;
            providerSubscriptionId: string | null;
            reminderSentAt: Date | null;
        };
        approvalUrl: string | null;
    }>;
    cancel(id: string, userId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        provider: import(".prisma/client").$Enums.PaymentProvider | null;
        planId: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
        providerSubscriptionId: string | null;
        reminderSentAt: Date | null;
    }>;
}
