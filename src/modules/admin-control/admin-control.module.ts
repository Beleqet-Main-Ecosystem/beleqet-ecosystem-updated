import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email/email.service';
import { IMailableTransporter, ISecurityAuditLogger } from './email/email.types';

/**
 * Real SMTP transporter that uses Nodemailer configured via environment variables.
 * Falls back to logging if SMTP credentials are not configured.
 */
class NodemailerTransporter implements IMailableTransporter {
  private readonly logger = new Logger('NodemailerTransporter');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user,
          pass: this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('SMTP_PASSWORD'),
        },
      });
      this.logger.log('SMTP transporter initialized');
    } else {
      this.logger.warn('SMTP not configured — emails will be logged but not sent');
    }
  }

  async sendMail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[DRY-RUN] Would send email to ${to}: ${subject}`);
      return true;
    }
    const from = this.configService.get<string>('EMAIL_FROM') || this.configService.get<string>('SMTP_FROM');
    await this.transporter.sendMail({ from, to, subject, html: htmlBody });
    return true;
  }
}

/**
 * Security audit logger that writes breach records to the application log.
 * In production this should forward to a SIEM or audit trail database.
 */
class SecurityAuditLogger implements ISecurityAuditLogger {
  private readonly logger = new Logger('SecurityAuditLogger');

  logSecurityBreach(userId: string, targetAction: string, details: string): void {
    this.logger.error(`[SECURITY BREACH] User=${userId} Action=${targetAction} Details=${details}`);
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    {
      provide: 'IMailableTransporter',
      useFactory: (config: ConfigService) => new NodemailerTransporter(config),
      inject: [ConfigService],
    },
    {
      provide: 'ISecurityAuditLogger',
      useClass: SecurityAuditLogger,
    },
  ],
  exports: [EmailService],
})
export class AdminControlModule {}
