import { PrismaService } from '../../../prisma/prisma.service';
import { AvailabilityOverlap } from '../types/availability.types';
export declare class CommonAvailabilityHelper {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findCommonAvailability(employerId: string, candidateId: string): Promise<AvailabilityOverlap[]>;
}
