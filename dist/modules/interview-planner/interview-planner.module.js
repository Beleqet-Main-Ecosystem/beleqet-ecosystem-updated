"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewPlannerModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const prisma_module_1 = require("../../prisma/prisma.module");
const interview_planner_controller_1 = require("./interview-planner.controller");
const interview_planner_service_1 = require("./interview-planner.service");
const queues_constants_1 = require("../queues/queues.constants");
const availability_helper_1 = require("./helpers/availability.helper");
const common_availability_helper_1 = require("./helpers/common-availability.helper");
const application_helper_1 = require("./helpers/application.helper");
const date_helper_1 = require("./helpers/date.helper");
const notifications_module_1 = require("../notifications/notifications.module");
let InterviewPlannerModule = class InterviewPlannerModule {
};
exports.InterviewPlannerModule = InterviewPlannerModule;
exports.InterviewPlannerModule = InterviewPlannerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            notifications_module_1.NotificationsModule,
            bullmq_1.BullModule.registerQueue({
                name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS,
            }),
        ],
        controllers: [interview_planner_controller_1.InterviewPlannerController],
        providers: [
            interview_planner_service_1.InterviewPlannerService,
            availability_helper_1.AvailabilityHelper,
            common_availability_helper_1.CommonAvailabilityHelper,
            application_helper_1.ApplicationHelper,
            date_helper_1.DateHelper,
        ],
        exports: [interview_planner_service_1.InterviewPlannerService],
    })
], InterviewPlannerModule);
//# sourceMappingURL=interview-planner.module.js.map