"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const redis_module_1 = require("../redis/redis.module");
const queues_module_1 = require("../queues/queues.module");
const auth_module_1 = require("../auth/auth.module");
const two_factor_controller_1 = require("./two-factor.controller");
const two_factor_service_1 = require("./two-factor.service");
const encryption_service_1 = require("./encryption.service");
const backup_code_service_1 = require("./backup-code.service");
const two_factor_processor_1 = require("./two-factor.processor");
const step_up_guard_1 = require("./guards/step-up.guard");
let TwoFactorModule = class TwoFactorModule {
};
exports.TwoFactorModule = TwoFactorModule;
exports.TwoFactorModule = TwoFactorModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => auth_module_1.AuthModule),
            redis_module_1.RedisModule,
            queues_module_1.QueuesModule,
            bullmq_1.BullModule.registerQueue({
                name: 'two-factor',
            }),
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_ACCESS_SECRET'),
                    signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES', '15m') },
                }),
            }),
        ],
        controllers: [two_factor_controller_1.TwoFactorController],
        providers: [
            two_factor_service_1.TwoFactorService,
            encryption_service_1.EncryptionService,
            backup_code_service_1.BackupCodeService,
            two_factor_processor_1.TwoFactorProcessor,
            step_up_guard_1.StepUpGuard,
        ],
        exports: [two_factor_service_1.TwoFactorService, encryption_service_1.EncryptionService, step_up_guard_1.StepUpGuard, jwt_1.JwtModule, bullmq_1.BullModule],
    })
], TwoFactorModule);
//# sourceMappingURL=two-factor.module.js.map