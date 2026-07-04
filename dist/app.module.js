"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
const bull_1 = require("@nestjs/bull");
const nestjs_i18n_1 = require("nestjs-i18n");
const path = require("path");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const jobs_module_1 = require("./modules/jobs/jobs.module");
const applications_module_1 = require("./modules/applications/applications.module");
const screening_module_1 = require("./modules/screening/screening.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const queues_module_1 = require("./modules/queues/queues.module");
const freelance_module_1 = require("./modules/freelance/freelance.module");
const escrow_module_1 = require("./modules/escrow/escrow.module");
const wallet_module_1 = require("./modules/wallet/wallet.module");
const admin_module_1 = require("./modules/admin/admin.module");
const chat_module_1 = require("./modules/chat/chat.module");
const uploads_module_1 = require("./modules/uploads/uploads.module");
const telegram_module_1 = require("./modules/telegram/telegram.module");
const contact_module_1 = require("./modules/contact/contact.module");
const kyc_module_1 = require("./modules/kyc/kyc.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'short', ttl: 1_000, limit: 10 },
                { name: 'medium', ttl: 10_000, limit: 50 },
                { name: 'long', ttl: 60_000, limit: 200 },
            ]),
            event_emitter_1.EventEmitterModule.forRoot({
                wildcard: true,
                delimiter: '.',
                maxListeners: 20,
            }),
            bull_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    redis: {
                        host: config.get('REDIS_HOST', 'localhost'),
                        port: config.get('REDIS_PORT', 6379),
                        password: config.get('REDIS_PASSWORD'),
                        tls: config.get('REDIS_TLS') === 'true' ? {} : undefined,
                    },
                    defaultJobOptions: {
                        removeOnComplete: 100,
                        removeOnFail: 200,
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 2_000 },
                    },
                }),
            }),
            nestjs_i18n_1.I18nModule.forRoot({
                fallbackLanguage: 'en',
                loaderOptions: {
                    path: path.join(__dirname, '/i18n/'),
                    watch: true,
                },
                resolvers: [
                    { use: nestjs_i18n_1.QueryResolver, options: ['lang'] },
                    nestjs_i18n_1.AcceptLanguageResolver,
                    new nestjs_i18n_1.HeaderResolver(['x-custom-lang']),
                ],
            }),
            prisma_module_1.PrismaModule,
            queues_module_1.QueuesModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            jobs_module_1.JobsModule,
            applications_module_1.ApplicationsModule,
            screening_module_1.ScreeningModule,
            notifications_module_1.NotificationsModule,
            analytics_module_1.AnalyticsModule,
            freelance_module_1.FreelanceModule,
            escrow_module_1.EscrowModule,
            wallet_module_1.WalletModule,
            admin_module_1.AdminModule,
            chat_module_1.ChatModule,
            uploads_module_1.UploadsModule,
            telegram_module_1.TelegramModule,
            contact_module_1.ContactModule,
            kyc_module_1.KycModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map