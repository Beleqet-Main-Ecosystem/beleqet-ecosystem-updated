import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
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
import { ChatModule } from './modules/chat/chat.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ContactModule } from './modules/contact/contact.module';
import { DbIndexMasterModule } from './modules/db-index-master/db-index-master.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    // ── Configuration (loads .env) ─────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate limiting ──────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 10_000, limit: 50 },
      { name: 'long', ttl: 60_000, limit: 200 },
    ]),

    // ── Event bus (in-process events between modules) ──────────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // ── BullMQ (Redis-backed job queues) ───────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100, // keep last 100 completed jobs
          removeOnFail: 200,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        },
      }),
    }),

    // ── Internationalization (i18n) ────────────────────────────────────────
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

    // ── Feature modules ────────────────────────────────────────────────────
    PrismaModule,
    QueuesModule,
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
    ChatModule,
    UploadsModule,
    TelegramModule,
    ContactModule,
    DbIndexMasterModule,
    PaymentsModule,
  ],
})
export class AppModule {}
