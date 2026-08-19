import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService, EMAIL_QUEUE_NAME } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailController } from './email.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { EmailGdprService } from './email-gdpr.service';

@Module({
  imports: [
    PrismaModule,
    // Only call forRoot() once per app — remove this if AppModule already
    // imports ScheduleModule.forRoot() elsewhere, to avoid double registration.
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: EMAIL_QUEUE_NAME }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: parseInt(config.get<string>('SMTP_PORT', '587'), 10),
          secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
          auth: {
            user: config.getOrThrow<string>('SMTP_USER'),
            pass: config.getOrThrow<string>('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: config.getOrThrow<string>('SMTP_FROM_ADDRESS'),
        },
        // Templates live at src/modules/email/templates/<locale>/<name>.hbs
        // so each supported language gets its own subfolder (i18n requirement).
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],
  controllers: [EmailController, UnsubscribeController],
  providers: [EmailService, EmailProcessor, EmailGdprService],
  exports: [EmailService, EmailGdprService],
})
export class EmailModule {}
