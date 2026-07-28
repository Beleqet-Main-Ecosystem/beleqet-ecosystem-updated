import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
export declare class PlansService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(includeInactive?: boolean): Prisma.PrismaPromise<{
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
    }[]>;
    findOne(id: string): Promise<{
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
    }>;
    create(dto: CreatePlanDto): Promise<{
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
    }>;
    update(id: string, dto: UpdatePlanDto): Promise<{
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
    }>;
    remove(id: string): Promise<{
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
    }>;
}
