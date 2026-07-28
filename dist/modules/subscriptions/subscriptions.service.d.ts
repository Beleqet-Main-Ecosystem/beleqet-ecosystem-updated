import { Prisma, PaymentProvider, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export type SubscriptionLifecycleEvent = 'ACTIVATED' | 'RENEWED' | 'PAYMENT_FAILED' | 'CANCELLED' | 'EXPIRED';
export interface SyncFromProviderEventInput {
    gatewayEventId: string;
    provider: PaymentProvider;
    eventType: SubscriptionLifecycleEvent;
    providerSubscriptionId: string;
    amount?: number;
    currency?: string;
    gatewayReference?: string;
    rawPayload?: Record<string, unknown>;
}
export declare class SubscriptionsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findMine(userId: string): Prisma.Prisma__SubscriptionClient<({
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
            features: Prisma.JsonValue;
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
    findAllForAdmin(status?: SubscriptionStatus): Prisma.PrismaPromise<({
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
            features: Prisma.JsonValue;
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
    createPendingCheckout(params: {
        userId: string;
        planId: string;
        provider: PaymentProvider;
        providerSubscriptionId: string;
    }): Promise<{
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
    assertNoActiveSubscription(userId: string): Promise<void>;
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
    syncFromProviderEvent(input: SyncFromProviderEventInput): Promise<void>;
    private recordWebhookEvent;
    private resolveStatusUpdate;
    private mapEventToTransactionStatus;
    sweepExpired(now?: Date): Promise<Array<{
        id: string;
        userId: string;
        planName: string;
    }>>;
    findAndMarkDueForReminder(daysAhead?: number, now?: Date): Promise<Array<{
        id: string;
        userId: string;
        planName: string;
        currentPeriodEnd: Date;
    }>>;
}
