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
var ErrorRecurrenceTrackerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRecurrenceTrackerService = void 0;
const common_1 = require("@nestjs/common");
const DEFAULT_WINDOW_MS = 5 * 60 * 1_000;
const DEFAULT_THRESHOLD = 10;
const MAX_OCCURRENCES = 500;
const MESSAGE_MAX_LEN = 200;
let ErrorRecurrenceTrackerService = ErrorRecurrenceTrackerService_1 = class ErrorRecurrenceTrackerService {
    constructor(windowMs = DEFAULT_WINDOW_MS, threshold = DEFAULT_THRESHOLD) {
        this.windowMs = windowMs;
        this.threshold = threshold;
        this.logger = new common_1.Logger(ErrorRecurrenceTrackerService_1.name);
        this.store = new Map();
        this.alerted = new Set();
    }
    track(errorCode, path, message) {
        const now = Date.now();
        if (!this.store.has(errorCode)) {
            this.store.set(errorCode, []);
        }
        const occurrences = this.store.get(errorCode);
        const cutoff = now - this.windowMs;
        const fresh = occurrences.filter((o) => o.timestamp >= cutoff);
        fresh.push({
            timestamp: now,
            path,
            message: message.substring(0, MESSAGE_MAX_LEN),
        });
        if (fresh.length > MAX_OCCURRENCES) {
            fresh.splice(0, fresh.length - MAX_OCCURRENCES);
        }
        this.store.set(errorCode, fresh);
        if (fresh.length >= this.threshold) {
            this.triggerAlert(errorCode, fresh, now);
        }
        else {
            this.alerted.delete(errorCode);
        }
    }
    getSnapshot() {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        const snapshots = [];
        for (const [code, occurrences] of this.store.entries()) {
            const fresh = occurrences.filter((o) => o.timestamp >= cutoff);
            if (fresh.length === 0)
                continue;
            snapshots.push({
                errorCode: code,
                hitCount: fresh.length,
                alertTriggered: this.alerted.has(code),
                recentTimestamps: fresh.slice(-5).map((o) => new Date(o.timestamp).toISOString()),
                topPaths: this.topN(fresh.map((o) => o.path), 3),
            });
        }
        return snapshots.sort((a, b) => b.hitCount - a.hitCount);
    }
    getByCode(errorCode) {
        const all = this.getSnapshot();
        return all.find((s) => s.errorCode === errorCode) ?? null;
    }
    reset() {
        this.store.clear();
        this.alerted.clear();
    }
    triggerAlert(errorCode, occurrences, now) {
        if (this.alerted.has(errorCode))
            return;
        this.alerted.add(errorCode);
        const topPaths = this.topN(occurrences.map((o) => o.path), 3);
        this.logger.error(JSON.stringify({
            level: 'CRITICAL',
            alert: 'RECURRING_ERROR_THRESHOLD_BREACHED',
            errorCode,
            hitCount: occurrences.length,
            windowMs: this.windowMs,
            threshold: this.threshold,
            topPaths,
            detectedAt: new Date(now).toISOString(),
        }));
    }
    topN(items, n) {
        const freq = new Map();
        for (const item of items) {
            freq.set(item, (freq.get(item) ?? 0) + 1);
        }
        return [...freq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([val]) => val);
    }
};
exports.ErrorRecurrenceTrackerService = ErrorRecurrenceTrackerService;
exports.ErrorRecurrenceTrackerService = ErrorRecurrenceTrackerService = ErrorRecurrenceTrackerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number, Number])
], ErrorRecurrenceTrackerService);
//# sourceMappingURL=error-recurrence-tracker.service.js.map