import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IEmailSender } from '../modules/auth/interfaces/email-sender.interface';
import { loadMailEnvConfig } from './mail.config';

/**
 * Real SMTP-backed mailer, implementing the same {@link IEmailSender}
 * interface the auth module depends on. No external Nest module
 * dependencies — it loads its own env config directly (mirrors the
 * pattern in `auth/config/auth.config.ts`), so it can be registered as a
 * plain provider with no `imports` needed.
 */
@Injectable()
export class MailService implements IEmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor() {
    const config = loadMailEnvConfig();
    this.fromAddress = config.fromAddress;
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    });
  }

  public async sendAccountLinkConfirmation(
    toEmail: string,
    confirmationUrl: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: toEmail,
      subject: 'Confirm linking your account — Beleqet',
      html: `
        <p>Someone tried to sign in using a social account linked to this email.</p>
        <p>If this was you, click below to confirm linking it to your Beleqet account:</p>
        <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }
}
