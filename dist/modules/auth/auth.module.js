"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const passport_1 = require("@nestjs/passport");
const bullmq_1 = require("@nestjs/bullmq");
const prisma_module_1 = require("../../prisma/prisma.module");
const queues_module_1 = require("../queues/queues.module");
const queues_constants_1 = require("../queues/queues.constants");
const auth_service_1 = require("./auth.service");
const account_linking_service_1 = require("./services/account-linking.service");
const token_encryption_service_1 = require("./services/token-encryption.service");
const account_repository_1 = require("./repositories/account.repository");
const auth_config_1 = require("./config/auth.config");
const token_cipher_interface_1 = require("./interfaces/token-cipher.interface");
const email_sender_interface_1 = require("./interfaces/email-sender.interface");
const mail_service_1 = require("../../mail/mail.service");
const audit_logger_interface_1 = require("./interfaces/audit-logger.interface");
const prisma_audit_logger_service_1 = require("./services/prisma-audit-logger.service");
const google_strategy_1 = require("./strategies/google.strategy");
const linkedin_strategy_1 = require("./strategies/linkedin.strategy");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const auth_controller_1 = require("./auth.controller");
const auth_exception_filter_1 = require("./filters/auth-exception.filter");
const two_factor_module_1 = require("../two-factor/two-factor.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            queues_module_1.QueuesModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                useFactory: (_configService) => {
                    const authConfig = (0, auth_config_1.loadAuthEnvConfig)();
                    return { secret: authConfig.jwtAccessSecret };
                },
                inject: [config_1.ConfigService],
            }),
            bullmq_1.BullModule.registerQueue({ name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS }),
            (0, common_1.forwardRef)(() => two_factor_module_1.TwoFactorModule),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            {
                provide: auth_config_1.AUTH_ENV_CONFIG,
                useFactory: () => (0, auth_config_1.loadAuthEnvConfig)(),
            },
            {
                provide: auth_config_1.TOKEN_ENCRYPTION_KEY,
                useFactory: (config) => config.tokenEncryptionKey,
                inject: [auth_config_1.AUTH_ENV_CONFIG],
            },
            auth_service_1.AuthService,
            token_encryption_service_1.TokenEncryptionService,
            account_repository_1.AccountRepository,
            {
                provide: token_cipher_interface_1.TOKEN_CIPHER,
                useExisting: token_encryption_service_1.TokenEncryptionService,
            },
            {
                provide: account_linking_service_1.ACCOUNT_REPOSITORY,
                useExisting: account_repository_1.AccountRepository,
            },
            account_linking_service_1.AccountLinkingService,
            prisma_audit_logger_service_1.PrismaAuditLogger,
            {
                provide: audit_logger_interface_1.AUDIT_LOGGER,
                useExisting: prisma_audit_logger_service_1.PrismaAuditLogger,
            },
            {
                provide: email_sender_interface_1.EMAIL_SENDER,
                useClass: mail_service_1.MailService,
            },
            google_strategy_1.GoogleStrategy,
            linkedin_strategy_1.LinkedInStrategy,
            jwt_strategy_1.JwtStrategy,
            {
                provide: core_1.APP_FILTER,
                useClass: auth_exception_filter_1.AuthExceptionFilter,
            },
        ],
        exports: [
            auth_service_1.AuthService,
            account_linking_service_1.AccountLinkingService,
            token_encryption_service_1.TokenEncryptionService,
            jwt_1.JwtModule,
            (0, common_1.forwardRef)(() => two_factor_module_1.TwoFactorModule),
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map