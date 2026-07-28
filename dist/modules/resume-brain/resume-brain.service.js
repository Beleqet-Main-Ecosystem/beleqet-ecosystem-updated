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
var ResumeBrainService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeBrainService = void 0;
const common_1 = require("@nestjs/common");
const path = require("path");
const resume_brain_constants_1 = require("./resume-brain.constants");
const document_parser_service_1 = require("./document-parser.service");
const ai_extractor_service_1 = require("./ai-extractor.service");
const ai_budget_service_1 = require("./ai-budget.service");
const resume_validator_service_1 = require("./resume-validator.service");
const profile_mapper_service_1 = require("./profile-mapper.service");
let ResumeBrainService = ResumeBrainService_1 = class ResumeBrainService {
    constructor(documentParser, aiExtractor, aiBudget, resumeValidator, profileMapper) {
        this.documentParser = documentParser;
        this.aiExtractor = aiExtractor;
        this.aiBudget = aiBudget;
        this.resumeValidator = resumeValidator;
        this.profileMapper = profileMapper;
        this.logger = new common_1.Logger(ResumeBrainService_1.name);
    }
    health() {
        return {
            status: 'ok',
            module: 'Resume Brain',
        };
    }
    describeUpload(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded. Expected form field "file".');
        }
        this.assertSupportedType(file);
        this.logger.log(`Accepted resume upload: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
        return {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        };
    }
    async parseResume(file) {
        const metadata = this.describeUpload(file);
        const text = await this.documentParser.extractText(file);
        return { ...metadata, text };
    }
    async extractProfile(file, userId) {
        const { text, ...metadata } = await this.parseResume(file);
        await this.aiBudget.assertWithinBudget(userId);
        const { resume: extracted, usage } = await this.aiExtractor.extract(text);
        await this.aiBudget.recordUsage(userId, usage);
        const profile = this.resumeValidator.validate(extracted);
        const userProfile = this.profileMapper.toUserProfile(profile);
        return {
            ...metadata,
            provider: this.aiExtractor.providerName,
            profile,
            userProfile,
        };
    }
    assertSupportedType(file) {
        const mimeOk = resume_brain_constants_1.ALLOWED_MIME_TYPES.includes(file.mimetype);
        const ext = path.extname(file.originalname || '').toLowerCase();
        const extOk = resume_brain_constants_1.ALLOWED_EXTENSIONS.includes(ext);
        if (!mimeOk || !extOk) {
            throw new common_1.UnsupportedMediaTypeException(`Unsupported file type "${file.mimetype || ext || 'unknown'}". ` +
                'Only PDF and DOCX resumes are allowed.');
        }
        this.assertMagicNumber(file, ext);
    }
    assertMagicNumber(file, ext) {
        const buffer = file.buffer;
        if (!buffer || buffer.length < 4) {
            throw new common_1.UnsupportedMediaTypeException('File is too small to be a valid PDF or DOCX resume.');
        }
        if (ext === '.pdf' && buffer.toString('ascii', 0, 4) !== '%PDF') {
            throw new common_1.UnsupportedMediaTypeException('File content does not match the PDF format.');
        }
        if (ext === '.docx' && buffer.toString('ascii', 0, 2) !== 'PK') {
            throw new common_1.UnsupportedMediaTypeException('File content does not match the DOCX format.');
        }
    }
};
exports.ResumeBrainService = ResumeBrainService;
exports.ResumeBrainService = ResumeBrainService = ResumeBrainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [document_parser_service_1.DocumentParserService,
        ai_extractor_service_1.AIExtractorService,
        ai_budget_service_1.AiBudgetService,
        resume_validator_service_1.ResumeValidatorService,
        profile_mapper_service_1.ProfileMapperService])
], ResumeBrainService);
//# sourceMappingURL=resume-brain.service.js.map