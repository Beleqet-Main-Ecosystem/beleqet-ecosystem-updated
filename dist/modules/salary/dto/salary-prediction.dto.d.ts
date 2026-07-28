export declare enum ExperienceLevel {
    JUNIOR = "JUNIOR",
    MID = "MID",
    SENIOR = "SENIOR",
    LEAD = "LEAD",
    PRINCIPAL = "PRINCIPAL"
}
export declare class CreateSalaryPredictionDto {
    jobTitle: string;
    jobCategoryId?: string;
    industry?: string;
    location: string;
    experienceLevel: ExperienceLevel;
    currency?: string;
}
export declare class SalaryPredictionResponseDto {
    id: string;
    jobTitle: string;
    location: string;
    experienceLevel: string;
    industry?: string;
    minSalary: number;
    maxSalary: number;
    averageSalary: number;
    medianSalary: number;
    currency: string;
    dataPointsCount: number;
    standardDeviation: number;
    confidenceScore: number;
    version: number;
    lastUpdatedAt: Date;
    createdAt: Date;
}
export declare class BatchSalaryPredictionDto {
    predictions: CreateSalaryPredictionDto[];
}
export declare class BatchSalaryPredictionResponseDto {
    predictions: SalaryPredictionResponseDto[];
    processedAt: Date;
    successCount: number;
    failureCount: number;
}
export declare class SalaryStatisticsDto {
    jobTitle?: string;
    location: string;
    industry?: string;
    experienceLevel?: string;
    averageSalary: number;
    medianSalary: number;
    salaryGrowthRate: number;
    currency: string;
    dataPointsCount: number;
    periodStartDate: Date;
    periodEndDate: Date;
}
export declare class SalaryPredictionQueryDto {
    jobTitle?: string;
    location?: string;
    experienceLevel?: ExperienceLevel;
    industry?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
