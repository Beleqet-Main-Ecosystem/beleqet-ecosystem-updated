import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';

/**
 * Enum for experience levels
 * Used for salary prediction calculations
 */
export enum ExperienceLevel {
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  PRINCIPAL = 'PRINCIPAL',
}

/**
 * Request DTO for predicting salary based on job parameters
 * Used in POST /salary/predict endpoint
 * @example
 * {
 *   jobTitle: "Full Stack Developer",
 *   industry: "Technology",
 *   location: "Addis Ababa",
 *   experienceLevel: "MID",
 *   currency: "ETB"
 * }
 */
export class CreateSalaryPredictionDto {
  /**
   * Job title/position to predict salary for
   * @example "Senior Software Engineer"
   */
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  /**
   * Job category slug (optional) for more precise matching
   * @example "software-development"
   */
  @IsOptional()
  @IsString()
  jobCategoryId?: string;

  /**
   * Industry sector for context
   * @example "Technology", "Finance", "Healthcare"
   */
  @IsOptional()
  @IsString()
  industry?: string;

  /**
   * Geographic location for salary adjustment
   * Supports city names or regions (e.g., "Addis Ababa", "Dire Dawa")
   * @example "Addis Ababa"
   */
  @IsString()
  @IsNotEmpty()
  location: string;

  /**
   * Experience level affecting salary range
   * JUNIOR (0-2 years), MID (2-5 years), SENIOR (5+ years), LEAD, PRINCIPAL
   * @example "SENIOR"
   */
  @IsEnum(ExperienceLevel)
  @IsNotEmpty()
  experienceLevel: ExperienceLevel;

  /**
   * Currency code for salary values
   * Defaults to ETB (Ethiopian Birr)
   * @example "ETB", "USD"
   */
  @IsOptional()
  @IsString()
  currency?: string = 'ETB';
}

/**
 * Response DTO for salary predictions
 * Contains calculated salary ranges and statistics
 */
export class SalaryPredictionResponseDto {
  /**
   * Unique identifier for prediction record
   */
  id: string;

  /**
   * Job title that was predicted
   */
  jobTitle: string;

  /**
   * Geographic location used in prediction
   */
  location: string;

  /**
   * Experience level used
   */
  experienceLevel: string;

  /**
   * Industry sector (if provided)
   */
  industry?: string;

  /**
   * Minimum salary in the predicted range
   * @example 50000
   */
  minSalary: number;

  /**
   * Maximum salary in the predicted range
   * @example 120000
   */
  maxSalary: number;

  /**
   * Average/mean salary from market data
   * @example 85000
   */
  averageSalary: number;

  /**
   * Median salary from dataset
   * @example 82000
   */
  medianSalary: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Number of job postings used in calculation
   * Higher numbers = more reliable prediction
   * @example 45
   */
  dataPointsCount: number;

  /**
   * Standard deviation of salary data
   * Shows salary variance in the market
   * @example 15000
   */
  standardDeviation: number;

  /**
   * Confidence score (0.0 - 1.0)
   * 0.8+ = high confidence, < 0.5 = low confidence
   * @example 0.85
   */
  confidenceScore: number;

  /**
   * Prediction model version
   */
  version: number;

  /**
   * Timestamp of last update
   */
  lastUpdatedAt: Date;

  /**
   * Creation timestamp
   */
  createdAt: Date;
}

/**
 * Batch salary prediction request DTO
 * For predicting multiple positions efficiently
 * @example
 * {
 *   predictions: [
 *     { jobTitle: "Developer", location: "Addis Ababa", experienceLevel: "SENIOR" },
 *     { jobTitle: "Designer", location: "Addis Ababa", experienceLevel: "MID" }
 *   ]
 * }
 */
export class BatchSalaryPredictionDto {
  /**
   * Array of salary prediction requests
   * Maximum 50 predictions per batch
   */
  @IsArray()
  @IsNotEmpty()
  predictions: CreateSalaryPredictionDto[];
}

/**
 * Response DTO for batch predictions
 */
export class BatchSalaryPredictionResponseDto {
  /**
   * Array of prediction results
   */
  predictions: SalaryPredictionResponseDto[];

  /**
   * Timestamp when batch was processed
   */
  processedAt: Date;

  /**
   * Number of successful predictions
   */
  successCount: number;

  /**
   * Number of failed predictions
   */
  failureCount: number;
}

/**
 * DTO for salary statistics and trends
 * Used for dashboard and analytics
 */
export class SalaryStatisticsDto {
  /**
   * Job title or category
   */
  jobTitle?: string;

  /**
   * Geographic location
   */
  location: string;

  /**
   * Industry sector
   */
  industry?: string;

  /**
   * Experience level
   */
  experienceLevel?: string;

  /**
   * Average salary across all matching positions
   */
  averageSalary: number;

  /**
   * Median salary
   */
  medianSalary: number;

  /**
   * Percentage month-over-month growth
   * Positive = salary growth, negative = decline
   * @example 2.5 (for 2.5% growth)
   */
  salaryGrowthRate: number;

  /**
   * Currency
   */
  currency: string;

  /**
   * Number of data points in this statistic
   */
  dataPointsCount: number;

  /**
   * Reporting period
   */
  periodStartDate: Date;
  periodEndDate: Date;
}

/**
 * Query DTO for filtering salary predictions
 * Used with GET endpoints
 */
export class SalaryPredictionQueryDto {
  /**
   * Filter by job title (partial match)
   */
  @IsOptional()
  @IsString()
  jobTitle?: string;

  /**
   * Filter by location
   */
  @IsOptional()
  @IsString()
  location?: string;

  /**
   * Filter by experience level
   */
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  /**
   * Filter by industry
   */
  @IsOptional()
  @IsString()
  industry?: string;

  /**
   * Pagination: page number (1-indexed)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Pagination: items per page (1-100)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Sort field: "salaryGrowthRate" | "averageSalary" | "dataPointsCount" | "createdAt"
   */
  @IsOptional()
  @IsString()
  sortBy?: string = 'lastUpdatedAt';

  /**
   * Sort direction: "asc" | "desc"
   */
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
