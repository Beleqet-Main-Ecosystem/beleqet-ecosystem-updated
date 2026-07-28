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
var CircuitBreakerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerService = exports.CircuitState = void 0;
const common_1 = require("@nestjs/common");
const nestjs_i18n_1 = require("nestjs-i18n");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
let CircuitBreakerService = CircuitBreakerService_1 = class CircuitBreakerService {
    constructor(i18n) {
        this.i18n = i18n;
        this.logger = new common_1.Logger(CircuitBreakerService_1.name);
        this.circuits = new Map();
        this.defaults = {
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 30_000,
            executionTimeout: 60_000,
        };
    }
    async execute(circuitName, action, options, lang = 'en') {
        const opts = { ...this.defaults, ...options };
        const circuit = this.getOrCreate(circuitName);
        if (circuit.state === CircuitState.OPEN) {
            if (Date.now() < circuit.nextRetryTime) {
                await this.fastFail(circuitName, lang);
            }
            circuit.state = CircuitState.HALF_OPEN;
            circuit.successCount = 0;
            circuit.halfOpenProbeInFlight = true;
            this.logger.log(`[CircuitBreaker] ${circuitName} → HALF_OPEN (probe claimed)`);
        }
        else if (circuit.state === CircuitState.HALF_OPEN) {
            if (circuit.halfOpenProbeInFlight) {
                this.logger.warn(`[CircuitBreaker] ${circuitName} HALF_OPEN — probe already in flight, rejecting`);
                await this.fastFail(circuitName, lang);
            }
            circuit.halfOpenProbeInFlight = true;
        }
        try {
            const result = await this.runWithExecutionTimeout(action, opts.executionTimeout, circuitName);
            this.recordSuccess(circuitName, circuit, opts);
            return result;
        }
        catch (err) {
            this.recordFailure(circuitName, circuit, opts, err);
            throw err;
        }
        finally {
            circuit.halfOpenProbeInFlight = false;
        }
    }
    getState(circuitName) {
        return this.circuits.get(circuitName)?.state ?? CircuitState.CLOSED;
    }
    reset(circuitName) {
        this.circuits.delete(circuitName);
        this.logger.log(`[CircuitBreaker] ${circuitName} manually reset → CLOSED`);
    }
    async runWithExecutionTimeout(action, executionTimeoutMs, circuitName) {
        if (!Number.isFinite(executionTimeoutMs) || executionTimeoutMs <= 0) {
            return action();
        }
        let timer;
        try {
            return await Promise.race([
                action(),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error(`CircuitBreaker execution timeout after ${executionTimeoutMs}ms (${circuitName})`));
                    }, executionTimeoutMs);
                    if (typeof timer === 'object' && 'unref' in timer) {
                        timer.unref();
                    }
                }),
            ]);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
    async fastFail(circuitName, lang) {
        const message = await this.i18n.t('video_interview.service_unavailable', { lang });
        this.logger.warn(`[CircuitBreaker] ${circuitName} — fast-failing`);
        throw new common_1.ServiceUnavailableException(message);
    }
    recordSuccess(name, circuit, opts) {
        circuit.failureCount = 0;
        if (circuit.state === CircuitState.HALF_OPEN) {
            circuit.successCount++;
            if (circuit.successCount >= opts.successThreshold) {
                circuit.state = CircuitState.CLOSED;
                this.logger.log(`[CircuitBreaker] ${name} → CLOSED (recovered)`);
            }
        }
    }
    recordFailure(name, circuit, opts, err) {
        circuit.failureCount++;
        circuit.lastFailureTime = Date.now();
        this.logger.error(`[CircuitBreaker] ${name} failure #${circuit.failureCount}: ${err.message}`);
        const shouldOpen = circuit.state === CircuitState.HALF_OPEN || circuit.failureCount >= opts.failureThreshold;
        if (shouldOpen) {
            circuit.state = CircuitState.OPEN;
            circuit.nextRetryTime = Date.now() + opts.timeout;
            this.logger.warn(`[CircuitBreaker] ${name} → OPEN (retry at ${new Date(circuit.nextRetryTime).toISOString()})`);
        }
    }
    getOrCreate(name) {
        if (!this.circuits.has(name)) {
            this.circuits.set(name, {
                state: CircuitState.CLOSED,
                failureCount: 0,
                successCount: 0,
                lastFailureTime: 0,
                nextRetryTime: 0,
                halfOpenProbeInFlight: false,
            });
        }
        return this.circuits.get(name);
    }
};
exports.CircuitBreakerService = CircuitBreakerService;
exports.CircuitBreakerService = CircuitBreakerService = CircuitBreakerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_i18n_1.I18nService])
], CircuitBreakerService);
//# sourceMappingURL=circuit-breaker.service.js.map