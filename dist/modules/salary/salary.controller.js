"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SalaryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const salary_service_1 = require("./salary.service");
const salary_prediction_dto_1 = require("./dto/salary-prediction.dto");
let SalaryController = SalaryController_1 = class SalaryController {
    constructor(salaryService) {
        this.salaryService = salaryService;
        this.logger = new common_1.Logger(SalaryController_1.name);
    }
    async predictSalary(dto) {
        this.logger.log(`[POST /predict] Predicting salary for: ${dto.jobTitle} in ${dto.location}`);
        return this.salaryService.predictSalary(dto);
    }
    async batchPredict(dto) {
        this.logger.log(`[POST /predict-batch] Processing batch of ${dto.predictions.length} predictions`);
        return this.salaryService.batchPredict(dto);
    }
    async getPredictions(query) {
        this.logger.log(`[GET /predictions] Fetching predictions with filters`);
        return this.salaryService.getPredictions(query);
    }
    async getSalaryStatistics(location, industry, daysBack, currency) {
        this.logger.log(`[GET /statistics/:location] Fetching statistics for: ${location}`);
        const days = daysBack ? parseInt(daysBack, 10) : 30;
        const targetCurrency = currency || 'ETB';
        return this.salaryService.getSalaryStatistics(location, industry, days, targetCurrency);
    }
    async getSalaryHistory(jobTitle, location, limit) {
        this.logger.log(`[GET /history] Fetching history for: ${jobTitle} in ${location}`);
        const limitNumRaw = limit ? parseInt(limit, 10) : 12;
        if (!Number.isFinite(limitNumRaw)) {
            throw new common_1.BadRequestException('Query param "limit" must be a valid number');
        }
        const limitNum = Math.min(60, limitNumRaw);
        return this.salaryService.getSalaryHistory(jobTitle, location, limitNum);
    }
    getHealth() {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
        };
    }
};
exports.SalaryController = SalaryController;
__decorate([
    (0, common_1.Post)('predict'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Predict salary for a job position',
        description: 'AI-powered salary prediction based on market data, industry, location, and experience level',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Salary prediction successfully calculated',
        type: salary_prediction_dto_1.SalaryPredictionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Bad request - invalid input parameters',
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Unauthorized - JWT token required',
    }),
    openapi.ApiResponse({ status: 200, type: require("./dto/salary-prediction.dto").SalaryPredictionResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [salary_prediction_dto_1.CreateSalaryPredictionDto]),
    __metadata("design:returntype", Promise)
], SalaryController.prototype, "predictSalary", null);
__decorate([
    (0, common_1.Post)('predict-batch'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Batch predict salaries for multiple positions',
        description: 'Process up to 50 salary predictions in a single request for better performance',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Batch predictions completed',
        type: salary_prediction_dto_1.BatchSalaryPredictionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Bad request - exceeds batch limit of 50',
    }),
    openapi.ApiResponse({ status: 200, type: require("./dto/salary-prediction.dto").BatchSalaryPredictionResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [salary_prediction_dto_1.BatchSalaryPredictionDto]),
    __metadata("design:returntype", Promise)
], SalaryController.prototype, "batchPredict", null);
__decorate([
    (0, common_1.Get)('predictions'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get salary predictions with filtering',
        description: 'Retrieve paginated list of salary predictions with optional filters',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Predictions retrieved successfully',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'jobTitle',
        required: false,
        description: 'Filter by job title (partial match)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'location',
        required: false,
        description: 'Filter by location',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'experienceLevel',
        required: false,
        description: 'Filter by experience level (JUNIOR, MID, SENIOR, LEAD, PRINCIPAL)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'industry',
        required: false,
        description: 'Filter by industry',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'page',
        required: false,
        description: 'Page number for pagination (default: 1)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        description: 'Items per page (default: 20, max: 100)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'sortBy',
        required: false,
        description: 'Sort field (default: lastUpdatedAt)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'sortOrder',
        required: false,
        description: 'Sort order: asc or desc (default: desc)',
    }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [salary_prediction_dto_1.SalaryPredictionQueryDto]),
    __metadata("design:returntype", Promise)
], SalaryController.prototype, "getPredictions", null);
__decorate([
    (0, common_1.Get)('statistics/:location'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get salary statistics for a location',
        description: 'Retrieve aggregated salary data, trends, and market analysis for a specific location',
    }),
    (0, swagger_1.ApiParam)({
        name: 'location',
        description: 'Geographic location (e.g., "Addis Ababa")',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'industry',
        required: false,
        description: 'Optional industry filter',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'daysBack',
        required: false,
        description: 'Number of days to look back (default: 30)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Statistics retrieved successfully',
        type: salary_prediction_dto_1.SalaryStatisticsDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'No salary data found for the specified location',
    }),
    openapi.ApiResponse({ status: 200, type: require("./dto/salary-prediction.dto").SalaryStatisticsDto }),
    __param(0, (0, common_1.Param)('location')),
    __param(1, (0, common_1.Query)('industry')),
    __param(2, (0, common_1.Query)('daysBack')),
    __param(3, (0, common_1.Query)('currency')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SalaryController.prototype, "getSalaryStatistics", null);
__decorate([
    (0, common_1.Get)('history/:jobTitle/:location'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get historical salary trends',
        description: 'Retrieve historical salary data for a position to analyze market trends',
    }),
    (0, swagger_1.ApiParam)({
        name: 'jobTitle',
        description: 'Job position name',
    }),
    (0, swagger_1.ApiParam)({
        name: 'location',
        description: 'Geographic location',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        description: 'Number of historical records (default: 12, max: 60)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Historical data retrieved successfully',
        type: [salary_prediction_dto_1.SalaryStatisticsDto],
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'No historical data found',
    }),
    openapi.ApiResponse({ status: 200, type: [require("./dto/salary-prediction.dto").SalaryStatisticsDto] }),
    __param(0, (0, common_1.Param)('jobTitle')),
    __param(1, (0, common_1.Param)('location')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SalaryController.prototype, "getSalaryHistory", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({
        summary: 'Health check',
        description: 'Verify salary service is operational',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Service is operational',
    }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SalaryController.prototype, "getHealth", null);
exports.SalaryController = SalaryController = SalaryController_1 = __decorate([
    (0, swagger_1.ApiTags)('Salary Helper - AI Powered'),
    (0, common_1.Controller)('api/v1/salary'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [salary_service_1.SalaryService])
], SalaryController);
//# sourceMappingURL=salary.controller.js.map