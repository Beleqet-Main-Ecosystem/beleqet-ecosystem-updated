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
exports.SubmitAnswersDto = exports.AnswerSubmissionDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AnswerSubmissionDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { questionId: { required: true, type: () => String }, selectedOption: { required: true, type: () => String, maxLength: 255 } };
    }
}
exports.AnswerSubmissionDto = AnswerSubmissionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'UUID of the assessment question',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AnswerSubmissionDto.prototype, "questionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Option selected by the candidate',
        example: 'A',
        maxLength: 255,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], AnswerSubmissionDto.prototype, "selectedOption", void 0);
class SubmitAnswersDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { sessionId: { required: true, type: () => String }, answers: { required: true, type: () => [require("./submit-answers.dto").AnswerSubmissionDto] } };
    }
}
exports.SubmitAnswersDto = SubmitAnswersDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'UUID of the skill assessment session',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SubmitAnswersDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Candidate answers keyed by question',
        type: [AnswerSubmissionDto],
        maxItems: 20,
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AnswerSubmissionDto),
    __metadata("design:type", Array)
], SubmitAnswersDto.prototype, "answers", void 0);
//# sourceMappingURL=submit-answers.dto.js.map