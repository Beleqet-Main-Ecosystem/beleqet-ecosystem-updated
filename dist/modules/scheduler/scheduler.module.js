"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const redis_module_1 = require("../redis/redis.module");
const subscriptions_module_1 = require("../subscriptions/subscriptions.module");
const notifications_module_1 = require("../notifications/notifications.module");
const scheduler_service_1 = require("./scheduler.service");
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), redis_module_1.RedisModule, subscriptions_module_1.SubscriptionsModule, notifications_module_1.NotificationsModule],
        providers: [scheduler_service_1.SchedulerService],
    })
], SchedulerModule);
//# sourceMappingURL=scheduler.module.js.map