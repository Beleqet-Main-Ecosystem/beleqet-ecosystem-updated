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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeBrainController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const resume_brain_service_1 = require("./resume-brain.service");
const resume_brain_constants_1 = require("./resume-brain.constants");
let ResumeBrainController = class ResumeBrainController {
    constructor(resumeBrainService) {
        this.resumeBrainService = resumeBrainService;
    }
    health() {
        return this.resumeBrainService.health();
    }
    upload(file) {
        return this.resumeBrainService.describeUpload(file);
    }
    parse(file) {
        return this.resumeBrainService.parseResume(file);
    }
    extract(file, user) {
        return this.resumeBrainService.extractProfile(file, user?.userId);
    }
};
exports.ResumeBrainController = ResumeBrainController;
__decorate([
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'Resume Brain module health check' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResumeBrainController.prototype, "health", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload a resume (PDF/DOCX, max 5MB) and echo back its metadata',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: resume_brain_constants_1.MAX_FILE_SIZE_BYTES } })),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResumeBrainController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('parse'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload a resume (PDF/DOCX, max 5MB) and extract its plain text (no AI yet)',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: resume_brain_constants_1.MAX_FILE_SIZE_BYTES } })),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResumeBrainController.prototype, "parse", null);
__decorate([
    (0, common_1.Post)('extract'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload a resume (PDF/DOCX, max 5MB), parse it and return a structured ' +
            'profile as JSON (Phase 4 — AI extraction)',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: resume_brain_constants_1.MAX_FILE_SIZE_BYTES } })),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ResumeBrainController.prototype, "extract", null);
exports.ResumeBrainController = ResumeBrainController = __decorate([
    (0, swagger_1.ApiTags)('resume-brain'),
    (0, common_1.Controller)('resume-brain'),
    __metadata("design:paramtypes", [resume_brain_service_1.ResumeBrainService])
], ResumeBrainController);
//# sourceMappingURL=resume-brain.controller.js.map