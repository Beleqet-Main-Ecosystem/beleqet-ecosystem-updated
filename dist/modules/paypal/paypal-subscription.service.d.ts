import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
export declare class PaypalSubscriptionService {
    private readonly prisma;
    private readonly auth;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, auth: PaypalAuthService, config: ConfigService);
    createSubscription(userId: string, dto: CreateSubscriptionDto): Promise<{
        localId: any;
        subscriptionId: string;
        approveUrl: string;
        planId: string;
        planLabel: string | undefined;
    }>;
    suspendSubscription(userId: string, subscriptionId: string): Promise<any>;
    cancelSubscription(userId: string, subscriptionId: string): Promise<any>;
    private findOwnedSubscription;
}
