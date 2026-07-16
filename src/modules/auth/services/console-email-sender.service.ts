import { Injectable, Logger } from '@nestjs/common';
import { IEmailSender } from '../interfaces/email-sender.interface';

/**
 * Development-only placeholder: logs the confirmation email instead of
 * sending it. Replace with a real implementation (SendGrid/SES/etc.) in
 * `auth.module.ts` before deploying — this is NOT safe for production
 * since confirmation links would only ever appear in server logs.
 */
@Injectable()
export class ConsoleEmailSender implements IEmailSender {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  public async sendAccountLinkConfirmation(
    toEmail: string,
    confirmationUrl: string,
  ): Promise<void> {
    this.logger.warn(
      `[DEV ONLY] Account-link confirmation for ${toEmail}: ${confirmationUrl}`,
    );
  }
}
