import { BillingInterval } from '@prisma/client';
export declare class CreatePlanDto {
    name: string;
    description?: string;
    priceAmount: number;
    currency?: string;
    interval?: BillingInterval;
    features: Record<string, unknown>;
    isActive?: boolean;
    paypalPlanId?: string;
}
