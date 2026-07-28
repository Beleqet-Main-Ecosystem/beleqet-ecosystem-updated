import { SubscriptionStatus } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
export declare class SubscriptionsController {
    private readonly subscriptionsService;
    private readonly checkoutService;
    constructor(subscriptionsService: SubscriptionsService, checkoutService: SubscriptionsCheckoutService);
    checkout(user: CurrentUserPayload, dto: CheckoutDto): Promise<{
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
    findMine(user: CurrentUserPayload): import(".prisma/client").Prisma.Prisma__SubscriptionClient<({
        plan: {
            name: string;
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            currency: string;
            priceAmount: number;
            interval: import(".prisma/client").$Enums.BillingInterval;
            features: import("@prisma/client/runtime/library").JsonValue;
            paypalPlanId: string | null;
        };
    } & {
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    cancel(id: string, user: CurrentUserPayload): Promise<{
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
    findAll(status?: SubscriptionStatus): import(".prisma/client").Prisma.PrismaPromise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
            id: string;
        };
        plan: {
            name: string;
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            currency: string;
            priceAmount: number;
            interval: import(".prisma/client").$Enums.BillingInterval;
            features: import("@prisma/client/runtime/library").JsonValue;
            paypalPlanId: string | null;
        };
    } & {
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
    })[]>;
}
