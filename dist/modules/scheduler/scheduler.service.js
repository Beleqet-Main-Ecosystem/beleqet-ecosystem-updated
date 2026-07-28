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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const crypto_1 = require("crypto");
const ioredis_1 = require("ioredis");
const redis_module_1 = require("../redis/redis.module");
const subscriptions_service_1 = require("../subscriptions/subscriptions.service");
const notifications_service_1 = require("../notifications/notifications.service");
const LOCK_TTL_MS = 5 * 60 * 1000;
const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(redis, subscriptionsService, notificationsService) {
        this.redis = redis;
        this.subscriptionsService = subscriptionsService;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(SchedulerService_1.name);
    }
    async handleExpirySweep() {
        await this.withLock('subscriptions-expiry-sweep', async () => {
            const expired = await this.subscriptionsService.sweepExpired();
            for (const subscription of expired) {
                await this.notificationsService.sendSubscriptionExpired(subscription.userId, subscription.planName);
            }
            if (expired.length > 0) {
                this.logger.log(`Expiry sweep: marked ${expired.length} subscription(s) EXPIRED`);
            }
        });
    }
    async handleExpiryReminders() {
        await this.withLock('subscriptions-expiry-reminder', async () => {
            const due = await this.subscriptionsService.findAndMarkDueForReminder(3);
            for (const subscription of due) {
                await this.notificationsService.sendSubscriptionExpiringSoon(subscription.userId, subscription.planName, subscription.currentPeriodEnd);
            }
            if (due.length > 0) {
                this.logger.log(`Expiry reminders: notified ${due.length} user(s)`);
            }
        });
    }
    async withLock(name, fn) {
        const key = `cron-lock:${name}`;
        const token = (0, crypto_1.randomUUID)();
        const acquired = await this.redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
        if (!acquired) {
            this.logger.log(`Skipping ${name} — another instance already holds the lock`);
            return;
        }
        try {
            await fn();
        }
        finally {
            await this.redis.eval(UNLOCK_SCRIPT, 1, key, token);
        }
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'subscriptions-expiry-sweep' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleExpirySweep", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM, { name: 'subscriptions-expiry-reminder' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleExpiryReminders", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default,
        subscriptions_service_1.SubscriptionsService,
        notifications_service_1.NotificationsService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map