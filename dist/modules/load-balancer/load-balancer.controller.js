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
exports.LoadBalancerController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const load_balancer_dto_1 = require("./dto/load-balancer.dto");
const load_balancer_health_check_service_1 = require("./load-balancer-health-check.service");
const load_balancer_service_1 = require("./load-balancer.service");
let LoadBalancerController = class LoadBalancerController {
    constructor(loadBalancerService, healthCheckService) {
        this.loadBalancerService = loadBalancerService;
        this.healthCheckService = healthCheckService;
    }
    ping() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
    getStatus() {
        return this.loadBalancerService.getStatus();
    }
    listBackendsPublic() {
        return this.loadBalancerService.listBackends(false);
    }
    routeRequest(dto, currencyHeader, regionHeader, sessionHeader, req) {
        const enriched = {
            ...dto,
            currency: dto.currency ?? currencyHeader,
            region: dto.region ?? regionHeader,
            sessionId: dto.sessionId ?? sessionHeader,
        };
        const clientIp = req.ip ?? req.socket.remoteAddress ?? '127.0.0.1';
        return this.loadBalancerService.routeRequest(enriched, clientIp);
    }
    releaseConnection(backendId) {
        this.loadBalancerService.releaseConnection(backendId);
    }
    listBackendsAdmin() {
        return this.loadBalancerService.listBackends(true);
    }
    getConfig() {
        return this.loadBalancerService.getConfig();
    }
    updateConfig(dto) {
        return this.loadBalancerService.updateConfig(dto);
    }
    registerBackend(dto) {
        return this.loadBalancerService.registerBackend(dto);
    }
    removeBackend(id) {
        return this.loadBalancerService.removeBackend(id);
    }
    triggerHealthCheck() {
        return this.healthCheckService.runHealthChecks();
    }
};
exports.LoadBalancerController = LoadBalancerController;
__decorate([
    (0, common_1.Get)('ping'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Health ping for upstream probes (public)' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Load-balancer pool status (public)' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('backends'),
    (0, swagger_1.ApiOperation)({ summary: 'List backend pool (public — URLs hidden)' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "listBackendsPublic", null);
__decorate([
    (0, common_1.Post)('route'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Select backend for an incoming request' }),
    (0, swagger_1.ApiHeader)({ name: 'X-Currency', required: false, description: 'ISO 4217 currency code' }),
    (0, swagger_1.ApiHeader)({ name: 'X-Region', required: false, description: 'ISO 3166-1 alpha-2 region' }),
    (0, swagger_1.ApiHeader)({ name: 'X-Session-Id', required: false, description: 'Sticky session identifier' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-currency')),
    __param(2, (0, common_1.Headers)('x-region')),
    __param(3, (0, common_1.Headers)('x-session-id')),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [load_balancer_dto_1.RouteRequestDto, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "routeRequest", null);
__decorate([
    (0, common_1.Post)('release/:backendId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Decrement active connection count for a backend' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.NO_CONTENT }),
    __param(0, (0, common_1.Param)('backendId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "releaseConnection", null);
__decorate([
    (0, common_1.Get)('admin/backends'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'List backends with internal URLs (admin audit)' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "listBackendsAdmin", null);
__decorate([
    (0, common_1.Get)('admin/config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get load-balancer configuration' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Patch)('admin/config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update load-balancer configuration' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [load_balancer_dto_1.UpdateLoadBalancerConfigDto]),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('admin/backends'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Register a backend instance' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [load_balancer_dto_1.RegisterBackendDto]),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "registerBackend", null);
__decorate([
    (0, common_1.Delete)('admin/backends/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a backend instance' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "removeBackend", null);
__decorate([
    (0, common_1.Post)('admin/health-check'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger an immediate health-check cycle' }),
    openapi.ApiResponse({ status: 201 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LoadBalancerController.prototype, "triggerHealthCheck", null);
exports.LoadBalancerController = LoadBalancerController = __decorate([
    (0, swagger_1.ApiTags)('load-balancer'),
    (0, common_1.Controller)('load-balancer'),
    __metadata("design:paramtypes", [load_balancer_service_1.LoadBalancerService,
        load_balancer_health_check_service_1.LoadBalancerHealthCheckService])
], LoadBalancerController);
//# sourceMappingURL=load-balancer.controller.js.map