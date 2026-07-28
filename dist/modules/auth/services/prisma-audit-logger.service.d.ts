import { PrismaService } from '../../../prisma/prisma.service';
import { IAuditLogger } from '../interfaces/audit-logger.interface';
export declare class PrismaAuditLogger implements IAuditLogger {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(eventType: string, entityId: string, payload: Record<string, unknown>): Promise<void>;
}
