import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';

/**
 * Event Listener that hooks into NestJS EventEmitter events and automatically 
 * generates notifications.
 */
@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('escrow.funded')
  async handleEscrowFunded(payload: { userId: string; contractId: string; amount: number; currency: string }) {
    this.logger.debug(`Captured event: escrow.funded for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'ESCROW',
      'Escrow Funded Successfully',
      `The escrow wallet for contract #${payload.contractId} has been funded with ${(payload.amount / 100).toFixed(2)} ${payload.currency}.`,
      { contractId: payload.contractId }
    );
  }

  @OnEvent('job.created')
  async handleJobCreated(payload: { userId: string; jobId: string; title: string }) {
    this.logger.debug(`Captured event: job.created for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'JOB_POST',
      'Job Posted Successfully',
      `Your job post "${payload.title}" is now active and open for bids.`,
      { jobId: payload.jobId }
    );
  }

  @OnEvent('milestone.approved')
  async handleMilestoneApproved(payload: { userId: string; contractId: string; milestoneId: string }) {
    this.logger.debug(`Captured event: milestone.approved for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'CONTRACT',
      'Milestone Approved',
      `Milestone #${payload.milestoneId} has been approved. Funds are now released to the freelancer.`,
      { contractId: payload.contractId, milestoneId: payload.milestoneId }
    );
  }

  @OnEvent('auth.login.failed')
  async handleFailedLogin(payload: { userId: string; ipAddress?: string }) {
    this.logger.debug(`Captured event: auth.login.failed for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'SECURITY',
      'Suspicious Login Attempt',
      `A failed login attempt was detected on your account from IP: ${payload.ipAddress || 'Unknown'}.`,
      { ip: payload.ipAddress }
    );
  }

  @OnEvent('subscription.expiring')
  async handleSubscriptionExpiring(payload: { userId: string; daysRemaining: number; userName: string }) {
    this.logger.debug(`Captured event: subscription.expiring for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'SUBSCRIPTION',
      'Subscription Expiring Soon',
      `Hi ${payload.userName}, your active plan expires in ${payload.daysRemaining} day(s). Please renew to maintain limits.`,
      { daysRemaining: payload.daysRemaining }
    );
  }

  @OnEvent('subscription.expired')
  async handleSubscriptionExpired(payload: { userId: string; userName: string }) {
    this.logger.debug(`Captured event: subscription.expired for user ${payload.userId}`);
    await this.notificationsService.sendNotification(
      payload.userId,
      'SUBSCRIPTION',
      'Subscription Expired',
      `Hi ${payload.userName}, your subscription has expired. Your account limits have defaulted back to the Free Plan.`,
      { expired: true }
    );
  }
}
