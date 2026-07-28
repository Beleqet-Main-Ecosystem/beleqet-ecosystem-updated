import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyService, CurrencyCode } from './currency/currency.service';
import { CreateSalaryPredictionDto, SalaryPredictionResponseDto, BatchSalaryPredictionDto, BatchSalaryPredictionResponseDto, SalaryStatisticsDto, SalaryPredictionQueryDto } from './dto/salary-prediction.dto';
export declare class SalaryService {
    private readonly prismaService;
    private readonly currencyService;
    private readonly logger;
    private readonly locationMultipliers;
    private readonly industryMultipliers;
    private readonly experienceLevelMultipliers;
    constructor(prismaService: PrismaService, currencyService: CurrencyService);
    predictSalary(dto: CreateSalaryPredictionDto): Promise<SalaryPredictionResponseDto>;
    getSalaryStatistics(location: string, industry?: string, daysBack?: number, targetCurrency?: CurrencyCode): Promise<SalaryStatisticsDto>;
    batchPredict(dto: BatchSalaryPredictionDto): Promise<BatchSalaryPredictionResponseDto>;
    getSalaryHistory(jobTitle: string, location: string, limit?: number): Promise<SalaryStatisticsDto[]>;
    getPredictions(query: SalaryPredictionQueryDto): Promise<{
        data: SalaryPredictionResponseDto[];
        total: number;
        page: number;
        limit: number;
    }>;
    private isPredictionFresh;
    private calculatePredictionFromJobData;
    private calculateSalaryGrowthRate;
    private calculateAggregateStatistics;
    private mapPredictionToResponse;
}
