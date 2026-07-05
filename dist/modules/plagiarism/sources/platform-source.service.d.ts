import { PrismaService } from '../../../prisma/prisma.service';
import { ComparisonDocument } from '../types/plagiarism.types';
export declare class PlatformSourceService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    loadDocuments(excludeEntityId?: string): Promise<ComparisonDocument[]>;
}
