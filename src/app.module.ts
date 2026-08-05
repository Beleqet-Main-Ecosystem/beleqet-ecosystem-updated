import { CacheConfigModule } from './cache/cache.module';
import configuration from './config/configuration';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';
import { APP_GUARD } from '@nestjs/core';

// Feature Modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ScreeningModule } from './modules/screening/screening.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { QueuesModule } from './modules/queues/queues.module';
import { FreelanceModule } from './modules/freelance/freelance.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminControlModule } from './modules/admin-control/admin-control.module';
import { ChatModule } from './modules/chat/chat.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ContactModule } from './modules/contact/contact.module';
import { GdprGuardModule } from './modules/gdpr-guard/gdpr-guard.module';
import { SalaryModule } from './modules/salary/salary.module';
import { VideoInterviewModule } from './modules/video-interview/video-interview.module';
import { PlagiarismModule } from './modules/plagiarism/plagiarism.module';
import { FaqBotModule } from './modules/faq-bot/faq-bot.module';
import { InterviewPlannerModule } from './modules/interview-planner/interview-planner.module';
import { DbIndexMasterModule } from './modules/db-index-master/db-index-master.module';
import { AnomalySensorModule } from './modules/anomaly-sensor/anomaly-sensor.module';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { DisputeManagerModule } from './modules/dispute-manager/dispute-manager.module';
import { AuditLoggingModule } from './modules/audit-logging/audit-logging.module';
import { PaymentsModule } from './modules/payments/payments.module';

// ── Fixed: PerformanceWorkerModule import statement deleted ──
import { CommunityForumModule } from './modules/community-forum/forum.module';
import { TwoFactorModule } from './modules/two-factor/two-factor.module';
import { KycModule } from './modules/kyc/kyc.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiFeedModule } from './modules/ai-feed/ai-feed.module';
import { ResumeBrainModule } from './modules/resume-brain/resume-brain.module';
import { SmartSkillTesterModule } from './modules/smart-skill-tester/smart-skill-tester.module';
import { TaxCalculatorModule } from './modules/tax-calculator/tax-calculator.module';
import { HealthModule } from './modules/health/health.module';

// GraphQL Layer
import { GqlThrottlerGuard } from './graphql/guards/gql-throttler.guard';
import { GraphqlConfigModule } from './graphql/graphql.module';

// Platform Extensions
import { SmartBiddingModule } from './modules/smart-bidding/smart-bidding.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { PromotedEngineModule } from './modules/promoted-engine/promoted-engine.module';
import { EmailModule } from '@modules/email-automation/email.module';

// ── Fixed: PerformanceWorkerModule import statement deleted ──
import { FraudAlertModule } from './modules/fraud-alert/fraud-alert.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ name: 'short', ttl: 1_000, limit: 10 }]),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: process.env.NODE_ENV === 'development',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-custom-lang']),
      ],
    }),
    GdprGuardModule,
    PrismaModule,
    QueuesModule,
    RedisModule,
    AuthModule,
    UsersModule,
    JobsModule,
    ApplicationsModule,
    ScreeningModule,
    NotificationsModule,
    AnalyticsModule,
    FreelanceModule,
    EscrowModule,
    WalletModule,
    AdminModule,
    AdminControlModule,
    ChatModule,
    UploadsModule,
    TelegramModule,
    ContactModule,
    VideoInterviewModule,
    PlagiarismModule,
    FaqBotModule,
    InterviewPlannerModule,
    AnomalySensorModule,
    AdminStatsModule,
    DisputeManagerModule,
    AuditLoggingModule,
    DbIndexMasterModule,
    PaymentsModule,
    CommunityForumModule,
    TwoFactorModule,
    KycModule,
    AuditModule,
    AiFeedModule,
    ResumeBrainModule,

    SmartSkillTesterModule,
    SalaryModule,
    TaxCalculatorModule,
    HealthModule,
    GraphqlConfigModule,
    SmartBiddingModule,
    PromotedEngineModule,
    UserPreferencesModule,
    PlansModule,
    SubscriptionsModule,
    BillingModule,
    SchedulerModule,
    FraudAlertModule,
    RbacModule,
    AuditLogModule,
    CacheConfigModule,
    EncryptionModule,
    EmailModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
