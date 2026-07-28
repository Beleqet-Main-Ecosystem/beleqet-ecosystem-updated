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
exports.EMPTY_EXTRACTED_RESUME = exports.ExtractedResumeDto = exports.ExtractedExperienceDto = exports.ExtractedEducationDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const MAX_LIST = 100;
class ExtractedEducationDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { school: { required: true, type: () => String, maxLength: 200 }, qualification: { required: true, type: () => String, maxLength: 200 }, year: { required: true, type: () => String, maxLength: 100 } };
    }
}
exports.ExtractedEducationDto = ExtractedEducationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedEducationDto.prototype, "school", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedEducationDto.prototype, "qualification", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ExtractedEducationDto.prototype, "year", void 0);
class ExtractedExperienceDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { role: { required: true, type: () => String, maxLength: 200 }, company: { required: true, type: () => String, maxLength: 200 }, start: { required: true, type: () => String, maxLength: 100 }, end: { required: true, type: () => String, maxLength: 100 }, description: { required: true, type: () => String, maxLength: 5000 } };
    }
}
exports.ExtractedExperienceDto = ExtractedExperienceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedExperienceDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedExperienceDto.prototype, "company", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ExtractedExperienceDto.prototype, "start", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ExtractedExperienceDto.prototype, "end", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], ExtractedExperienceDto.prototype, "description", void 0);
class ExtractedResumeDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { firstName: { required: true, type: () => String, maxLength: 200 }, lastName: { required: true, type: () => String, maxLength: 200 }, email: { required: true, type: () => String, maxLength: 320 }, phone: { required: true, type: () => String, maxLength: 100 }, summary: { required: true, type: () => String, maxLength: 5000 }, headline: { required: true, type: () => String, maxLength: 300 }, location: { required: true, type: () => String, maxLength: 300 }, skills: { required: true, type: () => [String], maxLength: 200 }, languages: { required: true, type: () => [String], maxLength: 200 }, certifications: { required: true, type: () => [String], maxLength: 300 }, education: { required: true, type: () => [require("./extracted-resume.dto").ExtractedEducationDto] }, experience: { required: true, type: () => [require("./extracted-resume.dto").ExtractedExperienceDto] } };
    }
}
exports.ExtractedResumeDto = ExtractedResumeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(320),
    (0, class_validator_1.ValidateIf)((o) => o.email !== ''),
    (0, class_validator_1.IsEmail)({}, { message: 'email must be a valid email address' }),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "summary", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "headline", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], ExtractedResumeDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(200, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(MAX_LIST),
    __metadata("design:type", Array)
], ExtractedResumeDto.prototype, "skills", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(200, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(MAX_LIST),
    __metadata("design:type", Array)
], ExtractedResumeDto.prototype, "languages", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(300, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(MAX_LIST),
    __metadata("design:type", Array)
], ExtractedResumeDto.prototype, "certifications", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LIST),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExtractedEducationDto),
    __metadata("design:type", Array)
], ExtractedResumeDto.prototype, "education", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LIST),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExtractedExperienceDto),
    __metadata("design:type", Array)
], ExtractedResumeDto.prototype, "experience", void 0);
exports.EMPTY_EXTRACTED_RESUME = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    summary: '',
    headline: '',
    location: '',
    skills: [],
    languages: [],
    certifications: [],
    education: [],
    experience: [],
};
//# sourceMappingURL=extracted-resume.dto.js.map