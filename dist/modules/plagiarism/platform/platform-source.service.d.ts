import { PrismaService } from '../../../prisma/prisma.service';
import { ComparisonDocument } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
export declare class PlatformSourceService {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, config: PlagiarismConfig);
    loadDocuments(excludeEntityId?: string): Promise<ComparisonDocument[]>;
}
