import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { HistoryService } from './history/history.service';
import { SimilarityService } from './similarity.service.ts/similarity.service';
import { InternetSourceService } from './sources/internet-source.service';
import { PlatformSourceService } from './sources/platform-source.service';
import { PlagiarismCheckResult } from './types/plagiarism.types';
export declare class PlagiarismService {
    private readonly similarityService;
    private readonly platformSource;
    private readonly internetSource;
    private readonly historyService;
    private readonly logger;
    constructor(similarityService: SimilarityService, platformSource: PlatformSourceService, internetSource: InternetSourceService, historyService: HistoryService);
    check(dto: CheckPlagiarismDto): Promise<PlagiarismCheckResult>;
    getHistory(limit?: number): Promise<PlagiarismCheckResult[]>;
    getCheckById(checkId: string): Promise<PlagiarismCheckResult>;
    private findMatches;
    private buildResult;
    private resolveVerdict;
}
