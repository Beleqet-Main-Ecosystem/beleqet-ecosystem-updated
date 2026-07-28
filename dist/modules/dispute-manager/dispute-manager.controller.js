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
exports.DisputeManagerController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const dispute_manager_service_1 = require("./dispute-manager.service");
const create_dispute_dto_1 = require("./dto/create-dispute.dto");
const resolve_dispute_dto_1 = require("./dto/resolve-dispute.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let DisputeManagerController = class DisputeManagerController {
    constructor(disputeManagerService) {
        this.disputeManagerService = disputeManagerService;
    }
    async create(user, createDisputeDto) {
        return this.disputeManagerService.createDispute(user.userId, createDisputeDto);
    }
    async findAll() {
        return this.disputeManagerService.getAllDisputes();
    }
    async resolve(id, resolveDto) {
        return this.disputeManagerService.resolveDispute(id, resolveDto);
    }
};
exports.DisputeManagerController = DisputeManagerController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('FREELANCER', 'EMPLOYER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_dispute_dto_1.CreateDisputeDto]),
    __metadata("design:returntype", Promise)
], DisputeManagerController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('ADMIN'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DisputeManagerController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(':id/resolve'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, resolve_dispute_dto_1.ResolveDisputeDto]),
    __metadata("design:returntype", Promise)
], DisputeManagerController.prototype, "resolve", null);
exports.DisputeManagerController = DisputeManagerController = __decorate([
    (0, common_1.Controller)('dispute'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [dispute_manager_service_1.DisputeManagerService])
], DisputeManagerController);
//# sourceMappingURL=dispute-manager.controller.js.map