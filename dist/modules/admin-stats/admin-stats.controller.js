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
exports.AdminStatsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const admin_stats_service_1 = require("./admin-stats.service");
const stats_query_dto_1 = require("./dto/stats-query.dto");
const roles_guard_1 = require("../../common/guards/roles.guard");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let AdminStatsController = class AdminStatsController {
    constructor(adminStatsService) {
        this.adminStatsService = adminStatsService;
    }
    async getDashboard(query) {
        return this.adminStatsService.getDashboardStats(query);
    }
};
exports.AdminStatsController = AdminStatsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)(new common_1.ValidationPipe({ transform: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stats_query_dto_1.StatsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminStatsController.prototype, "getDashboard", null);
exports.AdminStatsController = AdminStatsController = __decorate([
    (0, common_1.Controller)('admin-stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [admin_stats_service_1.AdminStatsService])
], AdminStatsController);
//# sourceMappingURL=admin-stats.controller.js.map