import { PrismaService } from '../../../prisma/prisma.service';
import { PlagiarismCheckResult } from '../types/plagiarism.types';
export declare class HistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    save(result: PlagiarismCheckResult): Promise<void>;
    findRecent(limit?: number): Promise<PlagiarismCheckResult[]>;
    findById(checkId: string): Promise<PlagiarismCheckResult>;
}
