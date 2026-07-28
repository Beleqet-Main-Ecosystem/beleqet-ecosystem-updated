import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { AvailabilityOverlap } from '../types/availability.types';
export declare class AvailabilityHelper {
    private readonly i18n;
    private readonly prisma;
    constructor(i18n: I18nService, prisma: PrismaService);
    validateAvailability(client: PrismaService | Prisma.TransactionClient, employerId: string, candidateId: string, startTime: Date, endTime: Date): Promise<void>;
    validateInterviewConflicts(client: PrismaService | Prisma.TransactionClient, employerId: string, candidateId: string, startTime: Date, endTime: Date): Promise<void>;
    findEarliestAvailableSlot(commonSlots: AvailabilityOverlap[], employerId: string, candidateId: string, durationMinutes: number): Promise<{
        startTime: Date;
        endTime: Date;
        timezone: string;
    } | null>;
}
