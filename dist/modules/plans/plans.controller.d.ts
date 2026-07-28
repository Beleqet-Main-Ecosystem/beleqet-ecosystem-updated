import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
export declare class PlansController {
    private readonly plansService;
    constructor(plansService: PlansService);
    findAll(includeInactive?: string): import(".prisma/client").Prisma.PrismaPromise<{
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
        features: import("@prisma/client/runtime/library").JsonValue;
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
        features: import("@prisma/client/runtime/library").JsonValue;
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
        features: import("@prisma/client/runtime/library").JsonValue;
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
        features: import("@prisma/client/runtime/library").JsonValue;
        paypalPlanId: string | null;
    }>;
}
