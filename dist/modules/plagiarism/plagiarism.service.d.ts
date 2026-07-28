import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { ChunkerService } from './chunker/chunker.service';
import { HistoryService } from './history/history.service';
import { InternetSourceService } from './internet/internet-source.service';
import { PlatformSourceService } from './platform/platform-source.service';
import { ReportService } from './report/report.service';
import { SimilarityEngineService } from './similarity/score-aggregator.service';
import { PlagiarismCheckResult } from './types/plagiarism.types';
import { NormalizationService } from './utils/normalization.service';
import { PlagiarismConfig } from './utils/plagiarism.config';
export declare class PlagiarismService {
    private readonly config;
    private readonly normalization;
    private readonly chunker;
    private readonly similarityEngine;
    private readonly platformSource;
    private readonly internetSource;
    private readonly reportService;
    private readonly historyService;
    private readonly logger;
    constructor(config: PlagiarismConfig, normalization: NormalizationService, chunker: ChunkerService, similarityEngine: SimilarityEngineService, platformSource: PlatformSourceService, internetSource: InternetSourceService, reportService: ReportService, historyService: HistoryService);
    check(dto: CheckPlagiarismDto): Promise<PlagiarismCheckResult>;
    getHistory(limit?: number): Promise<PlagiarismCheckResult[]>;
    getCheckById(checkId: string): Promise<PlagiarismCheckResult>;
    private findMatches;
    private compareDocument;
    private deduplicateDocuments;
    private deduplicatePhrases;
}
