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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryPredictionQueryDto = exports.SalaryStatisticsDto = exports.BatchSalaryPredictionResponseDto = exports.BatchSalaryPredictionDto = exports.SalaryPredictionResponseDto = exports.CreateSalaryPredictionDto = exports.ExperienceLevel = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var ExperienceLevel;
(function (ExperienceLevel) {
    ExperienceLevel["JUNIOR"] = "JUNIOR";
    ExperienceLevel["MID"] = "MID";
    ExperienceLevel["SENIOR"] = "SENIOR";
    ExperienceLevel["LEAD"] = "LEAD";
    ExperienceLevel["PRINCIPAL"] = "PRINCIPAL";
})(ExperienceLevel || (exports.ExperienceLevel = ExperienceLevel = {}));
class CreateSalaryPredictionDto {
    constructor() {
        this.currency = 'ETB';
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { jobTitle: { required: true, type: () => String }, jobCategoryId: { required: false, type: () => String }, industry: { required: false, type: () => String }, location: { required: true, type: () => String }, experienceLevel: { required: true, enum: require("./salary-prediction.dto").ExperienceLevel }, currency: { required: false, type: () => String, default: "ETB" } };
    }
}
exports.CreateSalaryPredictionDto = CreateSalaryPredictionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "jobTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "jobCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "industry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ExperienceLevel),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "experienceLevel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSalaryPredictionDto.prototype, "currency", void 0);
class SalaryPredictionResponseDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => String }, jobTitle: { required: true, type: () => String }, location: { required: true, type: () => String }, experienceLevel: { required: true, type: () => String }, industry: { required: false, type: () => String }, minSalary: { required: true, type: () => Number }, maxSalary: { required: true, type: () => Number }, averageSalary: { required: true, type: () => Number }, medianSalary: { required: true, type: () => Number }, currency: { required: true, type: () => String }, dataPointsCount: { required: true, type: () => Number }, standardDeviation: { required: true, type: () => Number }, confidenceScore: { required: true, type: () => Number }, version: { required: true, type: () => Number }, lastUpdatedAt: { required: true, type: () => Date }, createdAt: { required: true, type: () => Date } };
    }
}
exports.SalaryPredictionResponseDto = SalaryPredictionResponseDto;
class BatchSalaryPredictionDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { predictions: { required: true, type: () => [require("./salary-prediction.dto").CreateSalaryPredictionDto] } };
    }
}
exports.BatchSalaryPredictionDto = BatchSalaryPredictionDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Array)
], BatchSalaryPredictionDto.prototype, "predictions", void 0);
class BatchSalaryPredictionResponseDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { predictions: { required: true, type: () => [require("./salary-prediction.dto").SalaryPredictionResponseDto] }, processedAt: { required: true, type: () => Date }, successCount: { required: true, type: () => Number }, failureCount: { required: true, type: () => Number } };
    }
}
exports.BatchSalaryPredictionResponseDto = BatchSalaryPredictionResponseDto;
class SalaryStatisticsDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { jobTitle: { required: false, type: () => String }, location: { required: true, type: () => String }, industry: { required: false, type: () => String }, experienceLevel: { required: false, type: () => String }, averageSalary: { required: true, type: () => Number }, medianSalary: { required: true, type: () => Number }, salaryGrowthRate: { required: true, type: () => Number }, currency: { required: true, type: () => String }, dataPointsCount: { required: true, type: () => Number }, periodStartDate: { required: true, type: () => Date }, periodEndDate: { required: true, type: () => Date } };
    }
}
exports.SalaryStatisticsDto = SalaryStatisticsDto;
class SalaryPredictionQueryDto {
    constructor() {
        this.page = 1;
        this.limit = 20;
        this.sortBy = 'lastUpdatedAt';
        this.sortOrder = 'desc';
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { jobTitle: { required: false, type: () => String }, location: { required: false, type: () => String }, experienceLevel: { required: false, enum: require("./salary-prediction.dto").ExperienceLevel }, industry: { required: false, type: () => String }, page: { required: false, type: () => Number, default: 1, minimum: 1 }, limit: { required: false, type: () => Number, default: 20, minimum: 1, maximum: 100 }, sortBy: { required: false, type: () => String, default: "lastUpdatedAt" }, sortOrder: { required: false, type: () => Object, default: "desc" } };
    }
}
exports.SalaryPredictionQueryDto = SalaryPredictionQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "jobTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ExperienceLevel),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "experienceLevel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "industry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SalaryPredictionQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], SalaryPredictionQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "sortBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalaryPredictionQueryDto.prototype, "sortOrder", void 0);
//# sourceMappingURL=salary-prediction.dto.js.map