"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ResumeValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeValidatorService = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const extracted_resume_dto_1 = require("./dto/extracted-resume.dto");
let ResumeValidatorService = ResumeValidatorService_1 = class ResumeValidatorService {
    constructor() {
        this.logger = new common_1.Logger(ResumeValidatorService_1.name);
    }
    validate(input) {
        const dto = (0, class_transformer_1.plainToInstance)(extracted_resume_dto_1.ExtractedResumeDto, input ?? {});
        const errors = (0, class_validator_1.validateSync)(dto, {
            whitelist: true,
            forbidUnknownValues: false,
        });
        if (errors.length > 0) {
            const messages = this.flatten(errors);
            this.logger.warn(`Extracted resume failed validation: ${messages.join('; ')}`);
            throw new common_1.BadRequestException({
                message: 'The extracted resume failed validation.',
                errors: messages,
            });
        }
        if (this.isEmpty(dto)) {
            this.logger.warn('Extracted resume contained no usable profile data.');
            throw new common_1.BadRequestException('Could not extract a usable profile from this document. ' +
                'Please check that the file is a real resume.');
        }
        return dto;
    }
    isEmpty(r) {
        return (!r.firstName &&
            !r.lastName &&
            !r.email &&
            !r.phone &&
            !r.summary &&
            !r.headline &&
            !r.location &&
            (r.skills?.length ?? 0) === 0 &&
            (r.languages?.length ?? 0) === 0 &&
            (r.certifications?.length ?? 0) === 0 &&
            (r.education?.length ?? 0) === 0 &&
            (r.experience?.length ?? 0) === 0);
    }
    flatten(errors, parent = '') {
        const out = [];
        for (const err of errors) {
            const path = parent ? `${parent}.${err.property}` : err.property;
            if (err.constraints) {
                for (const msg of Object.values(err.constraints)) {
                    out.push(`${path}: ${msg}`);
                }
            }
            if (err.children?.length) {
                out.push(...this.flatten(err.children, path));
            }
        }
        return out;
    }
};
exports.ResumeValidatorService = ResumeValidatorService;
exports.ResumeValidatorService = ResumeValidatorService = ResumeValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], ResumeValidatorService);
//# sourceMappingURL=resume-validator.service.js.map