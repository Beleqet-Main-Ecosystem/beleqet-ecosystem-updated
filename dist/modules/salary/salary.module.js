"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const salary_controller_1 = require("./salary.controller");
const salary_service_1 = require("./salary.service");
const salary_processor_1 = require("./salary.processor");
const currency_service_1 = require("./currency/currency.service");
const prisma_module_1 = require("../../prisma/prisma.module");
let SalaryModule = class SalaryModule {
};
exports.SalaryModule = SalaryModule;
exports.SalaryModule = SalaryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            bullmq_1.BullModule.registerQueue({
                name: 'salary',
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            }),
        ],
        controllers: [salary_controller_1.SalaryController],
        providers: [salary_service_1.SalaryService, salary_processor_1.SalaryProcessor, currency_service_1.CurrencyService],
        exports: [salary_service_1.SalaryService],
    })
], SalaryModule);
//# sourceMappingURL=salary.module.js.map