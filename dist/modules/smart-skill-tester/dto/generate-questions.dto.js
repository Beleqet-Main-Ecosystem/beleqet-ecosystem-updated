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
exports.GenerateQuestionsDto = exports.SkillLevel = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var SkillLevel;
(function (SkillLevel) {
    SkillLevel["ENTRY"] = "ENTRY";
    SkillLevel["MID"] = "MID";
    SkillLevel["SENIOR"] = "SENIOR";
})(SkillLevel || (exports.SkillLevel = SkillLevel = {}));
class GenerateQuestionsDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { jobRole: { required: true, type: () => String, maxLength: 100 }, skillLevel: { required: true, enum: require("./generate-questions.dto").SkillLevel } };
    }
}
exports.GenerateQuestionsDto = GenerateQuestionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Target job role for question generation',
        example: 'Full Stack Developer',
        maxLength: 100,
    }),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value !== 'string') {
            return value;
        }
        return value
            .trim()
            .replace(/<[^>]*>/g, '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/\s+/g, ' ');
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GenerateQuestionsDto.prototype, "jobRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Candidate skill level',
        enum: SkillLevel,
        example: SkillLevel.MID,
    }),
    (0, class_validator_1.IsEnum)(SkillLevel),
    __metadata("design:type", String)
], GenerateQuestionsDto.prototype, "skillLevel", void 0);
//# sourceMappingURL=generate-questions.dto.js.map