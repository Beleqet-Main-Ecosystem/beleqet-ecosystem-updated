import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/accounts/auth/auth.module';
import { UsersModule } from './modules/accounts/users/users.module';
import { RedisModule } from './modules/platform/redis/redis.module';
import { JobsModule } from './modules/jobs/jobs/jobs.module';
import { ApplicationsModule } from './modules/jobs/applications/applications.module';
import { ScreeningModule } from './modules/jobs/screening/screening.module';
import { NotificationsModule } from './modules/messaging/notifications/notifications.module';
import { PushModule } from './modules/messaging/push/push.module';
import { AnalyticsModule } from './modules/platform/analytics/analytics.module';
import { QueuesModule } from './modules/platform/queues/queues.module';
import { AuditModule } from './modules/platform/audit/audit.module';
import { FreelanceModule } from './modules/freelance/freelance/freelance.module';
import { EscrowModule } from './modules/payments/escrow/escrow.module';
import { WalletModule } from './modules/payments/wallet/wallet.module';
import { AdminModule } from './modules/admin/admin/admin.module';
import { ChatModule } from './modules/messaging/chat/chat.module';
import { UploadsModule } from './modules/platform/uploads/uploads.module';
import { TelegramModule } from './modules/messaging/telegram/telegram.module';
import { ContactModule } from './modules/messaging/contact/contact.module';
import { SalaryModule } from './modules/jobs/salary/salary.module';
import { InterviewPlannerModule } from '@modules/jobs/interview-planner/interview-planner.module';
import { ChatToTextModule } from './modules/messaging/chat-to-text/chat-to-text.module';
import { ManualPaymentModule } from './modules/payments/manual-payment/manual-payment.module';
import { BeleqetPayWebhookModule } from './modules/payments/beleqet-pay/beleqet-pay-webhook.module';
import { APP_GUARD } from '@nestjs/core';
import { AdminStatsModule } from './modules/admin/admin-stats/admin-stats.module';
import { DisputeManagerModule } from './modules/freelance/dispute-manager/dispute-manager.module';

import { PaymentsModule } from './modules/payments/payments/payments.module';
// ── Fixed: PerformanceWorkerModule import statement deleted ──
import { GraphqlConfigModule } from './graphql/graphql.module';
import { GraphqlTurboModule } from './modules/jobs/graphql-turbo/graphql-turbo.module';
import { TwoFactorModule } from './modules/accounts/two-factor/two-factor.module';
import { AiFeedModule } from './modules/jobs/ai-feed/ai-feed.module';
import { ResumeBrainModule } from './modules/jobs/resume-brain/resume-brain.module';
import { CommunityForumModule } from './modules/messaging/community-forum/forum.module';
import { ReportsModule } from './modules/admin/reports/reports.module';
import { JobAlertsModule } from './modules/jobs/job-alerts/job-alerts.module';
import { GdprGuardModule } from './modules/accounts/gdpr-guard/gdpr-guard.module';
import { TaxCalculatorModule } from './modules/jobs/tax-calculator/tax-calculator.module';
import { HealthModule } from './modules/platform/health/health.module';
import { PlansModule } from './modules/payments/plans/plans.module';
import { SubscriptionsModule } from './modules/payments/subscriptions/subscriptions.module';
import { BillingModule } from './modules/payments/billing/billing.module';
import { SchedulerModule } from './modules/platform/scheduler/scheduler.module';
import { RbacModule } from './modules/accounts/rbac/rbac.module';

@Module({
  imports: [
    //  Configuration (loads .env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    //  Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 10_000, limit: 50 },
      { name: 'long', ttl: 60_000, limit: 200 },
    ]),

    //  Event bus (in-process events between modules)
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // ── Unified BullMQ (Redis-backed job queues) ───────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 200,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        },
      }),
    }),

    //  Internationalization (i18n)
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-custom-lang']),
      ],
    }),

    //  Feature modules. Unfinished ones (server code only, no screen yet) are in
    //  modules/unfinished/ and switched off; see its README.
    PrismaModule,
    QueuesModule,
    RedisModule,
    AuditModule,
    AuthModule,
    UsersModule,
    JobsModule,
    ApplicationsModule,
    ScreeningModule,
    NotificationsModule,
    PushModule,
    AnalyticsModule,
    FreelanceModule,
    EscrowModule,
    WalletModule,
    AdminModule,
    ChatModule,
    UploadsModule,
    TelegramModule,
    ContactModule,
    InterviewPlannerModule,
    AdminStatsModule,
    DisputeManagerModule,
    PaymentsModule,
    // ── Fixed: PerformanceWorkerModule removed from imports array ──
    GraphqlConfigModule,
    GraphqlTurboModule,
    TwoFactorModule,
    AiFeedModule,
    ResumeBrainModule,
    SalaryModule,
    TaxCalculatorModule,
    HealthModule,
    PlansModule,
    SubscriptionsModule,
    BillingModule,
    SchedulerModule,
    ChatToTextModule,
    ManualPaymentModule,
    BeleqetPayWebhookModule,
    CommunityForumModule,
    ReportsModule,
    JobAlertsModule,
    // Was never registered, so admin erasure and self-service deletion were unreachable.
    GdprGuardModule,
    RbacModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
