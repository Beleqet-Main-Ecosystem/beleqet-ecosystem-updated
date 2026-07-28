import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertingService } from './alerting.service';
interface AuthFailedPayload {
    email: string;
    ip?: string;
    timestamp: string;
}
interface AuthSuccessPayload {
    email: string;
    timestamp: string;
}
interface EscrowInitiatedPayload {
    escrowId: string;
    clientId: string;
    grossAmount: number;
    currency: string;
    timestamp: string;
}
export declare class AnomalySensorService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly alertingService;
    private readonly logger;
    private static readonly MAX_TRACKED_EMAILS;
    private authFailures;
    private cleanupInterval;
    constructor(prisma: PrismaService, alertingService: AlertingService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private pruneStaleAuthFailures;
    handleAuthFailed(payload: AuthFailedPayload): Promise<void>;
    handleAuthSuccess(payload: AuthSuccessPayload): void;
    handlePaymentInitiated(payload: EscrowInitiatedPayload): Promise<void>;
    private logAnomaly;
}
export {};
