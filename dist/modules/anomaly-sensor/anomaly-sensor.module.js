"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalySensorModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const queues_constants_1 = require("../queues/queues.constants");
const prisma_module_1 = require("../../prisma/prisma.module");
const alerting_service_1 = require("./alerting.service");
const anomaly_sensor_service_1 = require("./anomaly-sensor.service");
let AnomalySensorModule = class AnomalySensorModule {
};
exports.AnomalySensorModule = AnomalySensorModule;
exports.AnomalySensorModule = AnomalySensorModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            bullmq_1.BullModule.registerQueue({
                name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS,
            }),
        ],
        providers: [alerting_service_1.AlertingService, anomaly_sensor_service_1.AnomalySensorService],
        exports: [anomaly_sensor_service_1.AnomalySensorService],
    })
], AnomalySensorModule);
//# sourceMappingURL=anomaly-sensor.module.js.map