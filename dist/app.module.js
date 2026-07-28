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
const bullmq_1 = require("@nestjs/bullmq");
const nestjs_i18n_1 = require("nestjs-i18n");
const path = require("path");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const redis_module_1 = require("./modules/redis/redis.module");
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
const gdpr_guard_module_1 = require("./modules/gdpr-guard/gdpr-guard.module");
const salary_module_1 = require("./modules/salary/salary.module");
const video_interview_module_1 = require("./modules/video-interview/video-interview.module");
const plagiarism_module_1 = require("./modules/plagiarism/plagiarism.module");
const interview_planner_module_1 = require("./modules/interview-planner/interview-planner.module");
const db_index_master_module_1 = require("./modules/db-index-master/db-index-master.module");
const anomaly_sensor_module_1 = require("./modules/anomaly-sensor/anomaly-sensor.module");
const admin_stats_module_1 = require("./modules/admin-stats/admin-stats.module");
const dispute_manager_module_1 = require("./modules/dispute-manager/dispute-manager.module");
const payments_module_1 = require("./modules/payments/payments.module");
const two_factor_module_1 = require("./modules/two-factor/two-factor.module");
const kyc_module_1 = require("./modules/kyc/kyc.module");
const ai_feed_module_1 = require("./modules/ai-feed/ai-feed.module");
const resume_brain_module_1 = require("./modules/resume-brain/resume-brain.module");
const smart_skill_tester_module_1 = require("./modules/smart-skill-tester/smart-skill-tester.module");
const tax_calculator_module_1 = require("./modules/tax-calculator/tax-calculator.module");
const health_module_1 = require("./modules/health/health.module");
const gql_throttler_guard_1 = require("./graphql/guards/gql-throttler.guard");
const graphql_module_1 = require("./graphql/graphql.module");
const user_preferences_module_1 = require("./modules/user-preferences/user-preferences.module");
const plans_module_1 = require("./modules/plans/plans.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const billing_module_1 = require("./modules/billing/billing.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
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
            ]),
            event_emitter_1.EventEmitterModule.forRoot({
                wildcard: true,
                delimiter: '.',
            }),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('REDIS_HOST', 'localhost'),
                        port: config.get('REDIS_PORT', 6379),
                    },
                }),
            }),
            nestjs_i18n_1.I18nModule.forRoot({
                fallbackLanguage: 'en',
                loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
                resolvers: [{ use: nestjs_i18n_1.QueryResolver, options: ['lang'] }, nestjs_i18n_1.AcceptLanguageResolver],
            }),
            gdpr_guard_module_1.GdprGuardModule,
            prisma_module_1.PrismaModule,
            queues_module_1.QueuesModule,
            redis_module_1.RedisModule,
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
            video_interview_module_1.VideoInterviewModule,
            plagiarism_module_1.PlagiarismModule,
            interview_planner_module_1.InterviewPlannerModule,
            anomaly_sensor_module_1.AnomalySensorModule,
            admin_stats_module_1.AdminStatsModule,
            dispute_manager_module_1.DisputeManagerModule,
            db_index_master_module_1.DbIndexMasterModule,
            payments_module_1.PaymentsModule,
            two_factor_module_1.TwoFactorModule,
            kyc_module_1.KycModule,
            ai_feed_module_1.AiFeedModule,
            resume_brain_module_1.ResumeBrainModule,
            smart_skill_tester_module_1.SmartSkillTesterModule,
            salary_module_1.SalaryModule,
            tax_calculator_module_1.TaxCalculatorModule,
            health_module_1.HealthModule,
            graphql_module_1.GraphqlConfigModule,
            user_preferences_module_1.UserPreferencesModule,
            plans_module_1.PlansModule,
            subscriptions_module_1.SubscriptionsModule,
            billing_module_1.BillingModule,
            scheduler_module_1.SchedulerModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: gql_throttler_guard_1.GqlThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map