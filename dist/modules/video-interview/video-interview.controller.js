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
exports.VideoInterviewController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const video_interview_service_1 = require("./video-interview.service");
const create_interview_session_dto_1 = require("./dto/create-interview-session.dto");
const submit_response_dto_1 = require("./dto/submit-response.dto");
let VideoInterviewController = class VideoInterviewController {
    constructor(service) {
        this.service = service;
    }
    createSession(user, dto, lang = 'en') {
        return this.service.createSession(user.id, dto, lang);
    }
    getSession(id, user, lang = 'en') {
        return this.service.getSession(id, user.id, lang);
    }
    listByApplication(applicationId, user, lang = 'en') {
        return this.service.listByApplication(applicationId, user.id, lang);
    }
    submitResponse(id, user, dto, lang = 'en') {
        return this.service.submitResponse(id, user.id, dto, lang);
    }
    requestGdprDeletion(id, user, lang = 'en') {
        return this.service.requestGdprDeletion(id, user.id, lang);
    }
};
exports.VideoInterviewController = VideoInterviewController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create an AI video interview session (employer only)' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('accept-language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_interview_session_dto_1.CreateInterviewSessionDto, Object]),
    __metadata("design:returntype", void 0)
], VideoInterviewController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a video interview session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'VideoInterview UUID' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Headers)('accept-language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], VideoInterviewController.prototype, "getSession", null);
__decorate([
    (0, common_1.Get)('application/:applicationId'),
    (0, swagger_1.ApiOperation)({ summary: 'List interview sessions for an application (employer only)' }),
    (0, swagger_1.ApiParam)({ name: 'applicationId', description: 'Application UUID' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('applicationId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Headers)('accept-language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], VideoInterviewController.prototype, "listByApplication", null);
__decorate([
    (0, common_1.Post)(':id/responses'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a video response for an interview question' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'VideoInterview UUID' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('accept-language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, submit_response_dto_1.SubmitResponseDto, Object]),
    __metadata("design:returntype", void 0)
], VideoInterviewController.prototype, "submitResponse", null);
__decorate([
    (0, common_1.Delete)(':id/gdpr'),
    (0, swagger_1.ApiOperation)({ summary: 'Request GDPR deletion of all interview data' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'VideoInterview UUID' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Headers)('accept-language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], VideoInterviewController.prototype, "requestGdprDeletion", null);
exports.VideoInterviewController = VideoInterviewController = __decorate([
    (0, swagger_1.ApiTags)('video-interviews'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('video-interviews'),
    __metadata("design:paramtypes", [video_interview_service_1.VideoInterviewService])
], VideoInterviewController);
//# sourceMappingURL=video-interview.controller.js.map