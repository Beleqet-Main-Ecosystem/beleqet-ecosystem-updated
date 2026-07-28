import { SalaryService } from './salary.service';
import { CreateSalaryPredictionDto, SalaryPredictionResponseDto, BatchSalaryPredictionDto, BatchSalaryPredictionResponseDto, SalaryStatisticsDto, SalaryPredictionQueryDto } from './dto/salary-prediction.dto';
export declare class SalaryController {
    private readonly salaryService;
    private readonly logger;
    constructor(salaryService: SalaryService);
    predictSalary(dto: CreateSalaryPredictionDto): Promise<SalaryPredictionResponseDto>;
    batchPredict(dto: BatchSalaryPredictionDto): Promise<BatchSalaryPredictionResponseDto>;
    getPredictions(query: SalaryPredictionQueryDto): Promise<any>;
    getSalaryStatistics(location: string, industry?: string, daysBack?: string, currency?: string): Promise<SalaryStatisticsDto>;
    getSalaryHistory(jobTitle: string, location: string, limit?: string): Promise<SalaryStatisticsDto[]>;
    getHealth(): {
        status: string;
        timestamp: string;
    };
}
