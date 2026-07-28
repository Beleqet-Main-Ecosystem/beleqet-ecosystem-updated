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
exports.GdprGuardController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const gdpr_guard_service_1 = require("./gdpr-guard.service");
const data_erasure_request_dto_1 = require("./dto/data-erasure-request.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let GdprGuardController = class GdprGuardController {
    constructor(gdprGuardService) {
        this.gdprGuardService = gdprGuardService;
    }
    async requestErasure(dto, admin) {
        return this.gdprGuardService.executeDataErasure(dto.userId, {
            reason: dto.reason,
            actorUserId: admin.userId,
        });
    }
};
exports.GdprGuardController = GdprGuardController;
__decorate([
    (0, common_1.Post)('erase'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin-only GDPR data erasure for a target user' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [data_erasure_request_dto_1.DataErasureRequestDto, Object]),
    __metadata("design:returntype", Promise)
], GdprGuardController.prototype, "requestErasure", null);
exports.GdprGuardController = GdprGuardController = __decorate([
    (0, swagger_1.ApiTags)('Compliance'),
    (0, common_1.Controller)('v1/compliance/gdpr'),
    __metadata("design:paramtypes", [gdpr_guard_service_1.GdprGuardService])
], GdprGuardController);
//# sourceMappingURL=gdpr-guard.controller.js.map