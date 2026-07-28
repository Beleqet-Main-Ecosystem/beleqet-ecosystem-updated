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
exports.SubmitResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SubmitResponseDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { questionIndex: { required: true, type: () => Number, minimum: 0 }, videoUrl: { required: true, type: () => String }, language: { required: false, type: () => String } };
    }
}
exports.SubmitResponseDto = SubmitResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Zero-based index of the question being answered' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SubmitResponseDto.prototype, "questionIndex", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'https://s3.amazonaws.com/beleqet-uploads/interviews/abc.webm',
        description: 'Pre-signed S3 URL pointing to the uploaded video file',
    }),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitResponseDto.prototype, "videoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'en',
        default: 'en',
        description: 'BCP-47 language tag for Whisper',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitResponseDto.prototype, "language", void 0);
//# sourceMappingURL=submit-response.dto.js.map