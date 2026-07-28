"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeBrainModule = void 0;
const common_1 = require("@nestjs/common");
const resume_brain_service_1 = require("./resume-brain.service");
const resume_brain_controller_1 = require("./resume-brain.controller");
const document_parser_service_1 = require("./document-parser.service");
const ai_extractor_service_1 = require("./ai-extractor.service");
const ai_budget_service_1 = require("./ai-budget.service");
const resume_validator_service_1 = require("./resume-validator.service");
const profile_mapper_service_1 = require("./profile-mapper.service");
const ai_chat_provider_interface_1 = require("./ai/ai-chat-provider.interface");
const groq_provider_1 = require("./ai/groq.provider");
let ResumeBrainModule = class ResumeBrainModule {
};
exports.ResumeBrainModule = ResumeBrainModule;
exports.ResumeBrainModule = ResumeBrainModule = __decorate([
    (0, common_1.Module)({
        providers: [
            resume_brain_service_1.ResumeBrainService,
            document_parser_service_1.DocumentParserService,
            ai_extractor_service_1.AIExtractorService,
            ai_budget_service_1.AiBudgetService,
            resume_validator_service_1.ResumeValidatorService,
            profile_mapper_service_1.ProfileMapperService,
            { provide: ai_chat_provider_interface_1.AI_CHAT_PROVIDER, useClass: groq_provider_1.GroqProvider },
        ],
        controllers: [resume_brain_controller_1.ResumeBrainController],
        exports: [ai_chat_provider_interface_1.AI_CHAT_PROVIDER],
    })
], ResumeBrainModule);
//# sourceMappingURL=resume-brain.module.js.map