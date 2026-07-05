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
exports.CheckPlagiarismDto = exports.PlagiarismContentType = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var PlagiarismContentType;
(function (PlagiarismContentType) {
    PlagiarismContentType["JOB_DESCRIPTION"] = "JOB_DESCRIPTION";
    PlagiarismContentType["FREELANCE_JOB"] = "FREELANCE_JOB";
    PlagiarismContentType["COVER_LETTER"] = "COVER_LETTER";
    PlagiarismContentType["PROFILE"] = "PROFILE";
    PlagiarismContentType["COMPANY_PROFILE"] = "COMPANY_PROFILE";
    PlagiarismContentType["DELIVERABLE"] = "DELIVERABLE";
    PlagiarismContentType["OTHER"] = "OTHER";
})(PlagiarismContentType || (exports.PlagiarismContentType = PlagiarismContentType = {}));
class CheckPlagiarismDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { text: { required: true, type: () => String, minLength: 50, maxLength: 50000 }, contentType: { required: false, enum: require("./check-plagiarism.dto").PlagiarismContentType }, excludeEntityId: { required: false, type: () => String }, sourceUrls: { required: false, type: () => [String] }, threshold: { required: false, type: () => Number, minimum: 0, maximum: 1 } };
    }
}
exports.CheckPlagiarismDto = CheckPlagiarismDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Text to check for similarity', minLength: 50, maxLength: 50000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(50, 50000),
    __metadata("design:type", String)
], CheckPlagiarismDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: PlagiarismContentType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(PlagiarismContentType),
    __metadata("design:type", String)
], CheckPlagiarismDto.prototype, "contentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Platform entity ID to exclude (e.g. the job being edited)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CheckPlagiarismDto.prototype, "excludeEntityId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Public URLs to compare against (internet sources)',
        type: [String],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUrl)({}, { each: true }),
    __metadata("design:type", Array)
], CheckPlagiarismDto.prototype, "sourceUrls", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Minimum similarity score (0-1) to include in results',
        default: 0.25,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], CheckPlagiarismDto.prototype, "threshold", void 0);
//# sourceMappingURL=check-plagiarism.dto.js.map