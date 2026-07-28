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
exports.CreateInterviewSessionDto = exports.InterviewQuestionDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class InterviewQuestionDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => String }, text: { required: true, type: () => String }, durationSec: { required: true, type: () => Number, minimum: 15, maximum: 600 } };
    }
}
exports.InterviewQuestionDto = InterviewQuestionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'q1', description: 'Unique question identifier' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InterviewQuestionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tell me about yourself.' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InterviewQuestionDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 120, description: 'Max recording duration in seconds' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(15),
    (0, class_validator_1.Max)(600),
    __metadata("design:type", Number)
], InterviewQuestionDto.prototype, "durationSec", void 0);
class CreateInterviewSessionDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { applicationId: { required: true, type: () => String }, questions: { required: true, type: () => [require("./create-interview-session.dto").InterviewQuestionDto] }, scheduledAt: { required: false, type: () => String }, expiresAt: { required: false, type: () => String }, locale: { required: false, type: () => String } };
    }
}
exports.CreateInterviewSessionDto = CreateInterviewSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Application UUID this interview is attached to' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateInterviewSessionDto.prototype, "applicationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [InterviewQuestionDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => InterviewQuestionDto),
    __metadata("design:type", Array)
], CreateInterviewSessionDto.prototype, "questions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-07-10T10:00:00Z',
        description: 'When the interview link becomes active',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInterviewSessionDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-07-15T23:59:59Z',
        description: 'Hard deadline — session expires after this timestamp',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInterviewSessionDto.prototype, "expiresAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'en', default: 'en' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInterviewSessionDto.prototype, "locale", void 0);
//# sourceMappingURL=create-interview-session.dto.js.map