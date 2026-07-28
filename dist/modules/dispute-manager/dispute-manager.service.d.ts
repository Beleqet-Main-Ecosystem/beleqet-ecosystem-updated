import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { I18nService } from 'nestjs-i18n';
import type { Dispute } from '@prisma/client';
export declare class DisputeManagerService {
    private readonly prisma;
    private readonly i18n;
    constructor(prisma: PrismaService, i18n: I18nService);
    createDispute(userId: string, createDisputeDto: CreateDisputeDto): Promise<Dispute>;
    private sanitizePii;
    resolveDispute(disputeId: string, resolveDto: ResolveDisputeDto): Promise<{
        message: string;
        dispute: Dispute;
    }>;
    getAllDisputes(): Promise<Dispute[]>;
}
