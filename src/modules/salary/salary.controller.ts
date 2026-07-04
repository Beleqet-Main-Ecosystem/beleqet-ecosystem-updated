import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SalaryService } from './salary.service';
import {
  CreateSalaryPredictionDto,
  SalaryPredictionResponseDto,
  BatchSalaryPredictionDto,
  BatchSalaryPredictionResponseDto,
  SalaryStatisticsDto,
  SalaryPredictionQueryDto,
} from './dto/salary-prediction.dto';

/**
 * SalaryController - REST API endpoints for salary prediction and analysis
 *
 * Provides endpoints for:
 * - Single and batch salary predictions
 * - Market statistics and salary trends
 * - Historical salary data
 * - GDPR-compliant data queries
 */
@ApiTags('Salary Helper - AI Powered')
@Controller('api/v1/salary')
@UseGuards(JwtAuthGuard)
export class SalaryController {
  private readonly logger = new Logger(SalaryController.name);

  constructor(private readonly salaryService: SalaryService) {}

  /**
   * Predict salary for a single job position
   *
   * Takes job title, industry, location, and experience level
   * Returns predicted salary range with market statistics
   *
   * @param dto - Job parameters for prediction
   * @returns Salary prediction with confidence metrics
   * @example
   * POST /api/v1/salary/predict
   * {
   *   "jobTitle": "Senior Software Engineer",
   *   "industry": "Technology",
   *   "location": "Addis Ababa",
   *   "experienceLevel": "SENIOR"
   * }
   */
  @Post('predict')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Predict salary for a job position',
    description:
      'AI-powered salary prediction based on market data, industry, location, and experience level',
  })
  @ApiResponse({
    status: 200,
    description: 'Salary prediction successfully calculated',
    type: SalaryPredictionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid input parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async predictSalary(
    @Body() dto: CreateSalaryPredictionDto,
  ): Promise<SalaryPredictionResponseDto> {
    this.logger.log(`[POST /predict] Predicting salary for: ${dto.jobTitle} in ${dto.location}`);
    return this.salaryService.predictSalary(dto);
  }

  /**
   * Batch predict salaries for multiple positions
   *
   * Efficiently process up to 50 salary predictions at once
   * Returns array of predictions with success/failure metrics
   *
   * @param dto - Array of job parameters
   * @returns Batch predictions with processing metadata
   * @example
   * POST /api/v1/salary/predict-batch
   * {
   *   "predictions": [
   *     { "jobTitle": "Developer", "location": "Addis Ababa", "experienceLevel": "MID" },
   *     { "jobTitle": "Designer", "location": "Addis Ababa", "experienceLevel": "SENIOR" }
   *   ]
   * }
   */
  @Post('predict-batch')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Batch predict salaries for multiple positions',
    description: 'Process up to 50 salary predictions in a single request for better performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch predictions completed',
    type: BatchSalaryPredictionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - exceeds batch limit of 50',
  })
  async batchPredict(
    @Body() dto: BatchSalaryPredictionDto,
  ): Promise<BatchSalaryPredictionResponseDto> {
    this.logger.log(
      `[POST /predict-batch] Processing batch of ${dto.predictions.length} predictions`,
    );
    return this.salaryService.batchPredict(dto);
  }

  /**
   * Get all salary predictions with filtering
   *
   * Retrieve predictions with optional filtering and pagination
   * Useful for building dashboards and analytics
   *
   * @param query - Filter, sort, and pagination parameters
   * @returns Paginated list of salary predictions
   * @example
   * GET /api/v1/salary/predictions?location=Addis Ababa&limit=20&page=1
   */
  @Get('predictions')
  @ApiOperation({
    summary: 'Get salary predictions with filtering',
    description: 'Retrieve paginated list of salary predictions with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Predictions retrieved successfully',
  })
  @ApiQuery({
    name: 'jobTitle',
    required: false,
    description: 'Filter by job title (partial match)',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    description: 'Filter by location',
  })
  @ApiQuery({
    name: 'experienceLevel',
    required: false,
    description: 'Filter by experience level (JUNIOR, MID, SENIOR, LEAD, PRINCIPAL)',
  })
  @ApiQuery({
    name: 'industry',
    required: false,
    description: 'Filter by industry',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (default: lastUpdatedAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order: asc or desc (default: desc)',
  })
  async getPredictions(@Query() query: SalaryPredictionQueryDto): Promise<any> {
    this.logger.log(`[GET /predictions] Fetching predictions with filters`);
    return this.salaryService.getPredictions(query);
  }

  /**
   * Get salary statistics for a specific location
   *
   * Returns aggregated salary data including average, median, and growth rates
   * Perfect for dashboard analytics and market reports
   *
   * @param location - Geographic location
   * @param industry - Optional industry filter
   * @param daysBack - Days to look back (default: 30)
   * @returns Salary statistics and trends
   * @example
   * GET /api/v1/salary/statistics/Addis Ababa?industry=Technology&daysBack=30
   */
  @Get('statistics/:location')
  @ApiOperation({
    summary: 'Get salary statistics for a location',
    description:
      'Retrieve aggregated salary data, trends, and market analysis for a specific location',
  })
  @ApiParam({
    name: 'location',
    description: 'Geographic location (e.g., "Addis Ababa")',
  })
  @ApiQuery({
    name: 'industry',
    required: false,
    description: 'Optional industry filter',
  })
  @ApiQuery({
    name: 'daysBack',
    required: false,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: SalaryStatisticsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No salary data found for the specified location',
  })
  async getSalaryStatistics(
    @Param('location') location: string,
    @Query('industry') industry?: string,
    @Query('daysBack') daysBack?: string,
    @Query('currency') currency?: string,
  ): Promise<SalaryStatisticsDto> {
    this.logger.log(`[GET /statistics/:location] Fetching statistics for: ${location}`);
    const days = daysBack ? parseInt(daysBack, 10) : 30;
    const targetCurrency = currency || 'ETB';
    return this.salaryService.getSalaryStatistics(location, industry, days, targetCurrency as any);
  }

  /**
   * Get historical salary trends for a job position
   *
   * Retrieve past salary predictions to show market trends over time
   * Useful for analyzing salary growth and market dynamics
   *
   * @param jobTitle - Job position name
   * @param location - Geographic location
   * @param limit - Number of historical records (default: 12)
   * @returns Array of historical salary records
   * @example
   * GET /api/v1/salary/history/Senior Developer/Addis Ababa?limit=12
   */
  @Get('history/:jobTitle/:location')
  @ApiOperation({
    summary: 'Get historical salary trends',
    description: 'Retrieve historical salary data for a position to analyze market trends',
  })
  @ApiParam({
    name: 'jobTitle',
    description: 'Job position name',
  })
  @ApiParam({
    name: 'location',
    description: 'Geographic location',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of historical records (default: 12, max: 60)',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical data retrieved successfully',
    type: [SalaryStatisticsDto],
  })
  @ApiResponse({
    status: 404,
    description: 'No historical data found',
  })
  async getSalaryHistory(
    @Param('jobTitle') jobTitle: string,
    @Param('location') location: string,
    @Query('limit') limit?: string,
  ): Promise<SalaryStatisticsDto[]> {
    this.logger.log(`[GET /history] Fetching history for: ${jobTitle} in ${location}`);
    const limitNum = Math.min(60, limit ? parseInt(limit, 10) : 12);
    return this.salaryService.getSalaryHistory(jobTitle, location, limitNum);
  }

  /**
   * Health check endpoint
   *
   * Simple endpoint to verify the salary service is running
   *
   * @returns Service status
   * @example
   * GET /api/v1/salary/health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Verify salary service is operational',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is operational',
  })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
