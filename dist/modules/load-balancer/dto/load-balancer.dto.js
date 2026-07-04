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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteRequestDto = exports.UpdateLoadBalancerConfigDto = exports.RegisterBackendDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const load_balancer_constants_1 = require("../constants/load-balancer.constants");
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const REGION_PATTERN = /^[A-Z]{2}$/;
class RegisterBackendDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => String, minLength: 2, maxLength: 64 }, url: { required: true, type: () => String }, region: { required: false, type: () => String, pattern: "REGION_PATTERN" }, supportedCurrencies: { required: false, type: () => [String], pattern: "CURRENCY_PATTERN" }, weight: { required: false, type: () => Number, minimum: 1, maximum: 100 } };
    }
}
exports.RegisterBackendDto = RegisterBackendDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'backend-eu-1' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 64),
    __metadata("design:type", String)
], RegisterBackendDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'http://backend-1:4000' }),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], RegisterBackendDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ET', default: 'ET' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(REGION_PATTERN, { message: 'region must be a 2-letter ISO code' }),
    __metadata("design:type", String)
], RegisterBackendDto.prototype, "region", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['ETB', 'USD'], default: ['ETB'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(CURRENCY_PATTERN, { each: true, message: 'each currency must be ISO 4217' }),
    __metadata("design:type", Array)
], RegisterBackendDto.prototype, "supportedCurrencies", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], RegisterBackendDto.prototype, "weight", void 0);
class UpdateLoadBalancerConfigDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { strategy: { required: false, enum: require("../constants/load-balancer.constants").LoadBalancerStrategy }, stickySessionsEnabled: { required: false, type: () => Boolean }, healthCheckIntervalMs: { required: false, type: () => Number, minimum: 5000, maximum: 300000 }, healthCheckPath: { required: false, type: () => String, minLength: 1, maxLength: 256 } };
    }
}
exports.UpdateLoadBalancerConfigDto = UpdateLoadBalancerConfigDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: load_balancer_constants_1.LoadBalancerStrategy }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(load_balancer_constants_1.LoadBalancerStrategy),
    __metadata("design:type", String)
], UpdateLoadBalancerConfigDto.prototype, "strategy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Enable sticky sessions (session affinity)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateLoadBalancerConfigDto.prototype, "stickySessionsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30_000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5_000),
    (0, class_validator_1.Max)(300_000),
    __metadata("design:type", Number)
], UpdateLoadBalancerConfigDto.prototype, "healthCheckIntervalMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '/api/v1/load-balancer/ping' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 256),
    __metadata("design:type", String)
], UpdateLoadBalancerConfigDto.prototype, "healthCheckPath", void 0);
class RouteRequestDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { clientIp: { required: false, type: () => String, minLength: 3, maxLength: 45 }, sessionId: { required: false, type: () => String, minLength: 8, maxLength: 128 }, currency: { required: false, type: () => String, pattern: "CURRENCY_PATTERN" }, region: { required: false, type: () => String, pattern: "REGION_PATTERN" } };
    }
}
exports.RouteRequestDto = RouteRequestDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '192.168.1.10' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 45),
    __metadata("design:type", String)
], RouteRequestDto.prototype, "clientIp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Session ID for sticky-session affinity' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(8, 128),
    __metadata("design:type", String)
], RouteRequestDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ETB', description: 'ISO 4217 currency for multi-currency routing' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(CURRENCY_PATTERN, { message: 'currency must be ISO 4217' }),
    __metadata("design:type", String)
], RouteRequestDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ET' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(REGION_PATTERN, { message: 'region must be a 2-letter ISO code' }),
    __metadata("design:type", String)
], RouteRequestDto.prototype, "region", void 0);
//# sourceMappingURL=load-balancer.dto.js.map