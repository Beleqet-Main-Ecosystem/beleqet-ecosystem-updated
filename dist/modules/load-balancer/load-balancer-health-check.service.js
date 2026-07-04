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
var LoadBalancerHealthCheckService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerHealthCheckService = void 0;
const common_1 = require("@nestjs/common");
const load_balancer_service_1 = require("./load-balancer.service");
let LoadBalancerHealthCheckService = LoadBalancerHealthCheckService_1 = class LoadBalancerHealthCheckService {
    constructor(loadBalancerService) {
        this.loadBalancerService = loadBalancerService;
        this.logger = new common_1.Logger(LoadBalancerHealthCheckService_1.name);
        this.intervalHandle = null;
    }
    onModuleInit() {
        const intervalMs = this.loadBalancerService.getHealthCheckIntervalMs();
        this.intervalHandle = setInterval(() => {
            void this.runHealthChecks();
        }, intervalMs);
        this.logger.log(`Health-check scheduler started (every ${intervalMs}ms)`);
        void this.runHealthChecks();
    }
    onModuleDestroy() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
    async runHealthChecks() {
        const { healthCheckPath, healthCheckTimeoutMs } = this.loadBalancerService.getHealthCheckSettings();
        const backends = this.loadBalancerService.getBackendInstances();
        let healthy = 0;
        let unhealthy = 0;
        await Promise.all(backends.map(async (backend) => {
            const isHealthy = await this.probeBackend(backend.url, healthCheckPath, healthCheckTimeoutMs);
            this.loadBalancerService.setBackendHealth(backend.id, isHealthy);
            if (isHealthy) {
                healthy += 1;
            }
            else {
                unhealthy += 1;
            }
        }));
        this.logger.debug(`Health check complete: ${healthy} healthy, ${unhealthy} unhealthy / ${backends.length} total`);
        return { checked: backends.length, healthy, unhealthy };
    }
    async probeBackend(baseUrl, path, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            return response.ok;
        }
        catch {
            return false;
        }
        finally {
            clearTimeout(timer);
        }
    }
};
exports.LoadBalancerHealthCheckService = LoadBalancerHealthCheckService;
exports.LoadBalancerHealthCheckService = LoadBalancerHealthCheckService = LoadBalancerHealthCheckService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [load_balancer_service_1.LoadBalancerService])
], LoadBalancerHealthCheckService);
//# sourceMappingURL=load-balancer-health-check.service.js.map