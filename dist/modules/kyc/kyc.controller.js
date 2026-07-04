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
exports.KycController = exports.RejectKycDto = exports.SubmitKycDto = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const kyc_service_1 = require("./kyc.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
class SubmitKycDto {
}
exports.SubmitKycDto = SubmitKycDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.KycDocumentType, { message: 'documentType must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "documentType", void 0);
class RejectKycDto {
}
exports.RejectKycDto = RejectKycDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(5, { message: 'Rejection reason must be at least 5 characters long' }),
    __metadata("design:type", String)
], RejectKycDto.prototype, "reason", void 0);
let KycController = class KycController {
    constructor(kycService) {
        this.kycService = kycService;
    }
    async submitKyc(files, user, dto) {
        const documentFile = files?.document?.[0];
        const faceScanFile = files?.faceScan?.[0];
        if (!documentFile || !faceScanFile) {
            throw new common_1.BadRequestException('Both identification document and live face scan files must be uploaded.');
        }
        return this.kycService.submitVerification(user.userId, dto.documentType, documentFile, faceScanFile);
    }
    async getStatus(user) {
        return this.kycService.getVerificationStatus(user.userId);
    }
    async getPending() {
        return this.kycService.getPendingVerifications();
    }
    async approve(id, admin) {
        return this.kycService.approveVerification(id, admin.userId);
    }
    async reject(id, admin, dto) {
        return this.kycService.rejectVerification(id, admin.userId, dto.reason);
    }
};
exports.KycController = KycController;
__decorate([
    (0, common_1.Post)('submit'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit ID card and live face scan files for identity verification' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'document', maxCount: 1 },
        { name: 'faceScan', maxCount: 1 },
    ])),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, SubmitKycDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "submitKyc", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Check current KYC verification status and records' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('admin/pending'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'List all pending KYC submissions (Admin only)' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getPending", null);
__decorate([
    (0, common_1.Post)('admin/approve/:id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a pending KYC submission (Admin only)' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('admin/reject/:id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a pending KYC submission (Admin only)' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, RejectKycDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "reject", null);
exports.KycController = KycController = __decorate([
    (0, swagger_1.ApiTags)('kyc'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('kyc'),
    __metadata("design:paramtypes", [kyc_service_1.KycService])
], KycController);
//# sourceMappingURL=kyc.controller.js.map