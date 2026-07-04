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
exports.FreelanceController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const freelance_service_1 = require("./freelance.service");
const escrow_service_1 = require("../escrow/escrow.service");
let FreelanceController = class FreelanceController {
    constructor(svc, escrowSvc) {
        this.svc = svc;
        this.escrowSvc = escrowSvc;
    }
    findJobs(q) { return this.svc.findJobs(q); }
    findJob(id) { return this.svc.findJobById(id); }
    createJob(u, dto) { return this.svc.createJob(u.userId, dto); }
    submitBid(id, u, dto) { return this.svc.submitBid(u.userId, id, dto); }
    acceptBid(id, u) { return this.svc.acceptBid(id, u.userId); }
    rejectBid(id, u) { return this.svc.rejectBid(id, u.userId); }
    myBids(u) { return this.svc.getMyBids(u.userId); }
    myContracts(u) { return this.svc.getMyContracts(u.userId); }
    contract(id) { return this.svc.getContract(id); }
    createMilestone(id, u, dto) {
        return this.svc.createMilestone(u.userId, id, dto);
    }
    approveMilestone(id, u) { return this.escrowSvc.releaseMilestone(id, u.userId); }
};
exports.FreelanceController = FreelanceController;
__decorate([
    (0, common_1.Get)('jobs'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "findJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "findJob", null);
__decorate([
    (0, common_1.Post)('jobs'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, freelance_service_1.CreateFreelanceJobDto]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "createJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/bids'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, freelance_service_1.CreateBidDto]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "submitBid", null);
__decorate([
    (0, common_1.Patch)('bids/:id/accept'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "acceptBid", null);
__decorate([
    (0, common_1.Patch)('bids/:id/reject'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "rejectBid", null);
__decorate([
    (0, common_1.Get)('my-bids'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "myBids", null);
__decorate([
    (0, common_1.Get)('my-contracts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "myContracts", null);
__decorate([
    (0, common_1.Get)('contracts/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "contract", null);
__decorate([
    (0, common_1.Post)('contracts/:id/milestones'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, freelance_service_1.CreateMilestoneDto]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "createMilestone", null);
__decorate([
    (0, common_1.Patch)('milestones/:id/approve'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FreelanceController.prototype, "approveMilestone", null);
exports.FreelanceController = FreelanceController = __decorate([
    (0, swagger_1.ApiTags)('freelance'),
    (0, common_1.Controller)('freelance'),
    __metadata("design:paramtypes", [freelance_service_1.FreelanceService,
        escrow_service_1.EscrowService])
], FreelanceController);
//# sourceMappingURL=freelance.controller.js.map