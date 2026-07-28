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
exports.InterviewPlannerController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const interview_planner_service_1 = require("./interview-planner.service");
const create_availability_dto_1 = require("./dto/create-availability.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const swagger_1 = require("@nestjs/swagger");
const auto_schedule_interview_dto_1 = require("./dto/auto-schedule-interview.dto");
let InterviewPlannerController = class InterviewPlannerController {
    constructor(interviewPlannerService) {
        this.interviewPlannerService = interviewPlannerService;
    }
    createAvailability(req, dto) {
        return this.interviewPlannerService.createAvailability(req.user.userId, dto);
    }
    getAvailability(req) {
        return this.interviewPlannerService.getUserAvailabilities(req.user.userId);
    }
    updateAvailability(req, id, dto) {
        return this.interviewPlannerService.updateAvailability(req.user.userId, id, dto);
    }
    deleteAvailability(req, id) {
        return this.interviewPlannerService.deleteAvailability(req.user.userId, id);
    }
    autoScheduleInterview(req, dto) {
        return this.interviewPlannerService.autoScheduleInterview(req.user.userId, dto.applicationId);
    }
};
exports.InterviewPlannerController = InterviewPlannerController;
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Create user availability slot',
    }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('availability'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_availability_dto_1.CreateAvailabilityDto]),
    __metadata("design:returntype", void 0)
], InterviewPlannerController.prototype, "createAvailability", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Get current user availability slots',
    }),
    (0, common_1.Get)('availability'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InterviewPlannerController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Update an availability slot',
    }),
    (0, common_1.Patch)('availability/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_availability_dto_1.CreateAvailabilityDto]),
    __metadata("design:returntype", void 0)
], InterviewPlannerController.prototype, "updateAvailability", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete an availability slot',
    }),
    (0, common_1.Delete)('availability/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InterviewPlannerController.prototype, "deleteAvailability", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Automatically schedule an interview',
    }),
    (0, common_1.Post)('auto-schedule'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auto_schedule_interview_dto_1.AutoScheduleInterviewDto]),
    __metadata("design:returntype", void 0)
], InterviewPlannerController.prototype, "autoScheduleInterview", null);
exports.InterviewPlannerController = InterviewPlannerController = __decorate([
    (0, swagger_1.ApiTags)('Interview Planner'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('interview-planner'),
    __metadata("design:paramtypes", [interview_planner_service_1.InterviewPlannerService])
], InterviewPlannerController);
//# sourceMappingURL=interview-planner.controller.js.map