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
exports.UpdateApplicationStatusDto = exports.ApplicationStatus = exports.CreateApplicationDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateApplicationDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { jobId: { required: true, type: () => String }, coverLetter: { required: false, type: () => String, minLength: 50, maxLength: 10000 }, resumeUrl: { required: false, type: () => String, maxLength: 500 }, screeningAnswers: { required: false, type: () => Object }, portfolioUrl: { required: false, type: () => String }, expectedSalary: { required: false, type: () => Number } };
    }
}
exports.CreateApplicationDto = CreateApplicationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'UUID of the job being applied to', example: '123e4567-e89b-12d3-a456-426614174000' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "jobId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 'I am writing to express my interest in this position. I have over 5 years of experience building scalable backend APIs using NestJS and PostgreSQL...' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(50, { message: 'Cover letter must be at least 50 characters long' }),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "coverLetter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'URL to uploaded resume/CV', example: 'https://example.com/resume.pdf' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "resumeUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: { "Why do you want this job?": "I love coding." } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateApplicationDto.prototype, "screeningAnswers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 'https://github.com/beleqet' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "portfolioUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 50000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateApplicationDto.prototype, "expectedSalary", void 0);
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["SUBMITTED"] = "SUBMITTED";
    ApplicationStatus["SCREENING"] = "SCREENING";
    ApplicationStatus["SHORTLISTED"] = "SHORTLISTED";
    ApplicationStatus["INTERVIEW_SCHEDULED"] = "INTERVIEW_SCHEDULED";
    ApplicationStatus["OFFERED"] = "OFFERED";
    ApplicationStatus["REJECTED"] = "REJECTED";
    ApplicationStatus["WITHDRAWN"] = "WITHDRAWN";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
class UpdateApplicationStatusDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { status: { required: true, enum: require("./create-application.dto").ApplicationStatus } };
    }
}
exports.UpdateApplicationStatusDto = UpdateApplicationStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ApplicationStatus, enumName: 'ApplicationStatus', example: ApplicationStatus.SHORTLISTED }),
    (0, class_validator_1.IsEnum)(ApplicationStatus),
    __metadata("design:type", String)
], UpdateApplicationStatusDto.prototype, "status", void 0);
//# sourceMappingURL=create-application.dto.js.map