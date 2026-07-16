import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bull';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { ConfigService } from '@nestjs/config';

/**
 * Defines the structure for anomaly alert payloads.
 * Used across all alerting channels (Email, Slack, etc.)
 */
export interface AlertPayload {
  /** Short descriptive title of the anomaly */
  title: string;
  /** Detailed message explaining the anomaly */
  message: string;
  /** Severity level of the anomaly */
  severity: 'HIGH' | 'CRITICAL' | 'WARNING';
  /** ISO 8601 timestamp when the anomaly was detected */
  timestamp: string;
}

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * AlertingService - Dispatches anomaly alerts to configured channels.
 * Currently supports Email and Slack notifications.
 * Designed to be extensible for future channels (e.g., PagerDuty, Telegram).
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly slackWebhookUrl: string;

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    private readonly config: ConfigService,
  ) {
    this.slackWebhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL') || '';
  }

  /**
   * Dispatch an anomaly alert through multiple channels (Email, Slack).
   * Uses Promise.all to send alerts in parallel for faster notification.
   * @param payload - Details of the anomaly to alert about
   */
  async dispatchAlert(payload: AlertPayload): Promise<void> {
    try {
      await Promise.all([
        this.sendEmailAlert(payload),
        this.sendSlackAlert(payload),
      ]);
    } catch (error) {
      this.logger.error(`Failed to dispatch alert: ${(error as Error).message}`);
    }
  }

  /**
   * Sends an email alert to the security team via the notifications queue.
   * Uses the existing NotificationsQueue infrastructure for reliable delivery.
   * @param payload - Alert details including severity and description
   */
  private async sendEmailAlert(payload: AlertPayload): Promise<void> {
    const adminEmail = this.config.get<string>('SECURITY_ADMIN_EMAIL') || 'security@beleqet.com';

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
      to: adminEmail,
      subject: `[${escapeHtml(payload.severity)}] Beleqet Anomaly Detected: ${escapeHtml(payload.title)}`,
      html: `<p><strong>Anomaly Detected</strong></p>
             <p><strong>Title:</strong> ${escapeHtml(payload.title)}</p>
             <p><strong>Severity:</strong> ${escapeHtml(payload.severity)}</p>
             <p><strong>Time:</strong> ${escapeHtml(payload.timestamp)}</p>
             <p><strong>Details:</strong> ${escapeHtml(payload.message)}</p>`,
    });
    this.logger.debug(`Email alert queued for ${adminEmail}`);
  }

  /**
   * Sends a Slack notification to the security channel via Incoming Webhook.
   * Color-codes the attachment based on severity level:
   * - CRITICAL: Red (#FF0000)
   * - HIGH: Orange (#FFA500)
   * - WARNING: Yellow (#FFFF00)
   * @param payload - Alert details to post to Slack
   */
  private async sendSlackAlert(payload: AlertPayload): Promise<void> {
    if (!this.slackWebhookUrl) {
      this.logger.debug('Slack Webhook URL is not configured; skipping Slack alert.');
      return;
    }

    try {
      const color = payload.severity === 'CRITICAL' ? '#FF0000' : payload.severity === 'HIGH' ? '#FFA500' : '#FFFF00';
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color,
              title: `[${payload.severity}] ${payload.title}`,
              text: payload.message,
              footer: `Detected at ${payload.timestamp}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to send Slack alert. Slack returned status ${response.status}: ${await response.text()}`);
      } else {
        this.logger.debug('Slack alert sent.');
      }
    } catch (error) {
      this.logger.warn(`Failed to send Slack alert: ${(error as Error).message}`);
    }
  }
}
