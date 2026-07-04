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
var LoadBalancerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_i18n_1 = require("nestjs-i18n");
const load_balancer_constants_1 = require("./constants/load-balancer.constants");
const load_balancer_strategy_factory_1 = require("./strategies/load-balancer-strategy.factory");
const gdpr_sanitize_util_1 = require("./utils/gdpr-sanitize.util");
let LoadBalancerService = LoadBalancerService_1 = class LoadBalancerService {
    constructor(configService, strategyFactory, i18n) {
        this.configService = configService;
        this.strategyFactory = strategyFactory;
        this.i18n = i18n;
        this.logger = new common_1.Logger(LoadBalancerService_1.name);
        this.backends = new Map();
        this.stickySessions = new Map();
        this.config = this.buildInitialConfig();
        this.bootstrapBackendsFromEnv();
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(dto) {
        this.config = {
            ...this.config,
            ...(dto.strategy !== undefined && { strategy: dto.strategy }),
            ...(dto.stickySessionsEnabled !== undefined && {
                stickySessionsEnabled: dto.stickySessionsEnabled,
            }),
            ...(dto.healthCheckIntervalMs !== undefined && {
                healthCheckIntervalMs: dto.healthCheckIntervalMs,
            }),
            ...(dto.healthCheckPath !== undefined && { healthCheckPath: dto.healthCheckPath }),
        };
        this.logger.log(`Load-balancer config updated: strategy=${this.config.strategy}`);
        return this.getConfig();
    }
    registerBackend(dto) {
        if (this.backends.has(dto.id)) {
            throw new common_1.BadRequestException(this.i18n.translate('load-balancer.errors.backendExists', {
                args: { id: dto.id },
            }));
        }
        const instance = {
            id: dto.id,
            url: dto.url.replace(/\/$/, ''),
            region: dto.region ?? 'ET',
            supportedCurrencies: dto.supportedCurrencies ?? ['ETB'],
            activeConnections: 0,
            healthy: true,
            lastHealthCheckAt: null,
            weight: dto.weight ?? 1,
        };
        this.backends.set(dto.id, instance);
        this.logger.log(`Backend registered: ${dto.id} (${instance.region})`);
        return (0, gdpr_sanitize_util_1.toPublicBackendView)(instance);
    }
    removeBackend(backendId) {
        const existed = this.backends.delete(backendId);
        if (!existed) {
            throw new common_1.NotFoundException(this.i18n.translate('load-balancer.errors.backendNotFound', {
                args: { id: backendId },
            }));
        }
        for (const [sessionId, mappedId] of this.stickySessions.entries()) {
            if (mappedId === backendId) {
                this.stickySessions.delete(sessionId);
            }
        }
        return { removed: true };
    }
    listBackends(includeInternal = false) {
        const instances = Array.from(this.backends.values());
        if (includeInternal) {
            return instances.map((b) => ({ ...b }));
        }
        return instances.map(gdpr_sanitize_util_1.toPublicBackendView);
    }
    routeRequest(dto, clientIpFallback = '127.0.0.1') {
        const context = this.buildRouteContext(dto, clientIpFallback);
        const candidates = this.filterCandidates(context);
        if (candidates.length === 0) {
            throw new common_1.ServiceUnavailableException(this.i18n.translate('load-balancer.errors.noHealthyBackend'));
        }
        let selected = null;
        if (this.config.stickySessionsEnabled && context.sessionId) {
            selected = this.resolveStickyBackend(context.sessionId, candidates);
        }
        if (!selected) {
            const strategy = this.strategyFactory.getStrategy(this.config.strategy);
            selected = strategy.select(candidates, context);
        }
        if (!selected) {
            throw new common_1.ServiceUnavailableException(this.i18n.translate('load-balancer.errors.routingFailed'));
        }
        if (this.config.stickySessionsEnabled && context.sessionId) {
            this.stickySessions.set(context.sessionId, selected.id);
        }
        selected.activeConnections += 1;
        this.logger.debug(`Routed to ${selected.id} via ${this.config.strategy} (client=${(0, gdpr_sanitize_util_1.pseudonymizeIp)(context.clientIp)})`);
        return {
            backendId: selected.id,
            targetUrl: selected.url,
            strategy: this.config.strategy,
            sessionAffinity: this.config.stickySessionsEnabled,
        };
    }
    releaseConnection(backendId) {
        const backend = this.backends.get(backendId);
        if (backend && backend.activeConnections > 0) {
            backend.activeConnections -= 1;
        }
    }
    setBackendHealth(backendId, healthy) {
        const backend = this.backends.get(backendId);
        if (!backend)
            return;
        backend.healthy = healthy;
        backend.lastHealthCheckAt = new Date();
        if (!healthy) {
            this.logger.warn(`Backend ${backendId} marked UNHEALTHY`);
        }
    }
    getStatus() {
        const all = Array.from(this.backends.values());
        return {
            totalBackends: all.length,
            healthyBackends: all.filter((b) => b.healthy).length,
            strategy: this.config.strategy,
            stickySessionsEnabled: this.config.stickySessionsEnabled,
            activeStickySessions: this.stickySessions.size,
        };
    }
    getBackendInstances() {
        return Array.from(this.backends.values());
    }
    getHealthCheckSettings() {
        return {
            healthCheckPath: this.config.healthCheckPath,
            healthCheckTimeoutMs: this.config.healthCheckTimeoutMs,
        };
    }
    getHealthCheckIntervalMs() {
        return this.config.healthCheckIntervalMs;
    }
    buildRouteContext(dto, clientIp) {
        return {
            clientIp: dto.clientIp ?? clientIp,
            sessionId: dto.sessionId,
            currency: dto.currency?.toUpperCase(),
            region: dto.region?.toUpperCase(),
        };
    }
    filterCandidates(context) {
        return Array.from(this.backends.values()).filter((backend) => {
            if (!backend.healthy)
                return false;
            if (context.currency && !backend.supportedCurrencies.includes(context.currency)) {
                return false;
            }
            if (context.region && backend.region !== context.region) {
                return false;
            }
            return true;
        });
    }
    resolveStickyBackend(sessionId, candidates) {
        const mappedId = this.stickySessions.get(sessionId);
        if (!mappedId)
            return null;
        const stickyBackend = candidates.find((b) => b.id === mappedId);
        if (!stickyBackend) {
            this.stickySessions.delete(sessionId);
            return null;
        }
        return stickyBackend;
    }
    buildInitialConfig() {
        const strategyRaw = this.configService.get('LOAD_BALANCER_STRATEGY', load_balancer_constants_1.LoadBalancerStrategy.ROUND_ROBIN);
        const strategy = Object.values(load_balancer_constants_1.LoadBalancerStrategy).includes(strategyRaw)
            ? strategyRaw
            : load_balancer_constants_1.LoadBalancerStrategy.ROUND_ROBIN;
        return {
            strategy,
            stickySessionsEnabled: this.configService.get('LOAD_BALANCER_STICKY_SESSIONS', 'true') === 'true',
            healthCheckIntervalMs: Number(this.configService.get('LOAD_BALANCER_HEALTH_CHECK_INTERVAL_MS', String(load_balancer_constants_1.DEFAULT_HEALTH_CHECK_INTERVAL_MS))),
            healthCheckPath: this.configService.get('LOAD_BALANCER_HEALTH_CHECK_PATH', load_balancer_constants_1.DEFAULT_HEALTH_CHECK_PATH),
            healthCheckTimeoutMs: Number(this.configService.get('LOAD_BALANCER_HEALTH_CHECK_TIMEOUT_MS', '5000')),
        };
    }
    bootstrapBackendsFromEnv() {
        const raw = this.configService.get('LOAD_BALANCER_BACKENDS', '');
        if (!raw.trim())
            return;
        for (const entry of raw.split(';').filter(Boolean)) {
            const [idPart, rest] = entry.split('=');
            if (!idPart || !rest)
                continue;
            const segments = rest.split(':');
            const url = segments[0];
            const region = segments[1] ?? 'ET';
            const currencies = segments[2]?.split(',').filter(Boolean) ?? ['ETB'];
            this.backends.set(idPart.trim(), {
                id: idPart.trim(),
                url: url.trim(),
                region: region.toUpperCase(),
                supportedCurrencies: currencies.map((c) => c.toUpperCase()),
                activeConnections: 0,
                healthy: true,
                lastHealthCheckAt: null,
                weight: 1,
            });
        }
        this.logger.log(`Bootstrapped ${this.backends.size} backend(s) from environment`);
    }
};
exports.LoadBalancerService = LoadBalancerService;
exports.LoadBalancerService = LoadBalancerService = LoadBalancerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        load_balancer_strategy_factory_1.LoadBalancerStrategyFactory,
        nestjs_i18n_1.I18nService])
], LoadBalancerService);
//# sourceMappingURL=load-balancer.service.js.map