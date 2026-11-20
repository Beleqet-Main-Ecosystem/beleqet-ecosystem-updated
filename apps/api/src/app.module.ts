import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ScreeningModule } from './modules/screening/screening.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PushModule } from './modules/push/push.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { QueuesModule } from './modules/queues/queues.module';
import { FreelanceModule } from './modules/freelance/freelance.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ContactModule } from './modules/contact/contact.module';
import { SalaryModule } from './modules/salary/salary.module';
import { InterviewPlannerModule } from '@modules/interview-planner/interview-planner.module';
import { ChatToTextModule } from './modules/chat-to-text/chat-to-text.module';
import { ManualPaymentModule } from './modules/manual-payment/manual-payment.module';
import { BeleqetPayModule } from './modules/beleqet-pay/beleqet-pay.module';
import { APP_GUARD } from '@nestjs/core';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { DisputeManagerModule } from './modules/dispute-manager/dispute-manager.module';

import { PaymentsModule } from './modules/payments/payments.module';
// ── Fixed: PerformanceWorkerModule import statement deleted ──
import { GraphqlConfigModule } from './graphql/graphql.module';
import { GraphqlTurboModule } from './modules/graphql-turbo/graphql-turbo.module';
import { TwoFactorModule } from './modules/two-factor/two-factor.module';
import { AiFeedModule } from './modules/ai-feed/ai-feed.module';
import { ResumeBrainModule } from './modules/resume-brain/resume-brain.module';
import { CommunityForumModule } from './modules/community-forum/forum.module';
import { ReportsModule } from './modules/reports/reports.module';
import { JobAlertsModule } from './modules/job-alerts/job-alerts.module';
import { GdprGuardModule } from './modules/gdpr-guard/gdpr-guard.module';
import { TaxCalculatorModule } from './modules/tax-calculator/tax-calculator.module';
import { HealthModule } from './modules/health/health.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { RbacModule } from './modules/rbac/rbac.module';

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
    BeleqetPayModule,
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
