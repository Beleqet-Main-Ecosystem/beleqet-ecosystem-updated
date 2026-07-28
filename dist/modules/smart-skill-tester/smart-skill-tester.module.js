"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSkillTesterModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../prisma/prisma.module");
const resume_brain_module_1 = require("../resume-brain/resume-brain.module");
const skill_tester_invalid_payload_filter_1 = require("./skill-tester-invalid-payload.filter");
const smart_skill_tester_controller_1 = require("./smart-skill-tester.controller");
const smart_skill_tester_service_1 = require("./smart-skill-tester.service");
let SmartSkillTesterModule = class SmartSkillTesterModule {
};
exports.SmartSkillTesterModule = SmartSkillTesterModule;
exports.SmartSkillTesterModule = SmartSkillTesterModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, resume_brain_module_1.ResumeBrainModule],
        controllers: [smart_skill_tester_controller_1.SmartSkillTesterController],
        providers: [smart_skill_tester_service_1.SmartSkillTesterService, skill_tester_invalid_payload_filter_1.SkillTesterInvalidPayloadFilter],
        exports: [smart_skill_tester_service_1.SmartSkillTesterService],
    })
], SmartSkillTesterModule);
//# sourceMappingURL=smart-skill-tester.module.js.map