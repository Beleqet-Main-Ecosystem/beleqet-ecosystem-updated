"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const jobs_service_1 = require("./jobs.service");
const jobs_controller_1 = require("./jobs.controller");
const queues_constants_1 = require("../queues/queues.constants");
const jobs_resolver_1 = require("./jobs.resolver");
const company_loader_1 = require("../../graphql/loaders/company.loader");
const category_loader_1 = require("../../graphql/loaders/category.loader");
let JobsModule = class JobsModule {
};
exports.JobsModule = JobsModule;
exports.JobsModule = JobsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            bullmq_1.BullModule.registerQueue({ name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS }),
        ],
        providers: [jobs_service_1.JobsService, jobs_resolver_1.JobsResolver, company_loader_1.CompanyLoader, category_loader_1.CategoryLoader],
        controllers: [jobs_controller_1.JobsController],
        exports: [jobs_service_1.JobsService],
    })
], JobsModule);
//# sourceMappingURL=jobs.module.js.map