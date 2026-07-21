import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Scheduler that checks database daily for subscription expirations and reminders.
 */
@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Daily Cron job at midnight to process subscription lifecycle events.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionChecks() {
    this.logger.log('Starting daily subscription check...');
    await this.processExpirations();
    await this.processReminders();
    this.logger.log('Daily subscription check finished.');
  }

  /**
   * Identifies subscriptions that have reached their period end and updates their status to EXPIRED.
   */
  async processExpirations() {
    const now = new Date();

    // Find active subscriptions that have passed their currentPeriodEnd date
    const expiredSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
      include: { user: true },
    });

    this.logger.log(`Found ${expiredSubs.length} subscriptions to expire.`);

    for (const sub of expiredSubs) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'EXPIRED',
          endedAt: now,
        },
      });

      this.eventEmitter.emit('subscription.expired', {
        userId: sub.userId,
        userEmail: sub.user.email,
        userName: `${sub.user.firstName} ${sub.user.lastName}`,
      });

      this.logger.log(`Subscription for user ${sub.userId} has expired.`);
    }
  }

  /**
   * Scans for active subscriptions approaching their end dates to send notifications.
   * Sends alerts 3 days and 1 day before expiration.
   */
  async processReminders() {
    const now = new Date();

    // 1. Alert for exactly 3 days remaining
    const threeDaysFromNowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const threeDaysFromNowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const warn3Days = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: threeDaysFromNowStart,
          lte: threeDaysFromNowEnd,
        },
      },
      include: { user: true },
    });

    for (const sub of warn3Days) {
      this.eventEmitter.emit('subscription.expiring', {
        userId: sub.userId,
        userEmail: sub.user.email,
        userName: `${sub.user.firstName} ${sub.user.lastName}`,
        daysRemaining: 3,
      });
      this.logger.log(`Queued 3-day expiration warning for user ${sub.userId}`);
    }

    // 2. Alert for exactly 1 day remaining
    const oneDayFromNowStart = new Date(now.getTime());
    const oneDayFromNowEnd = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const warn1Day = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: oneDayFromNowStart,
          lte: oneDayFromNowEnd,
        },
      },
      include: { user: true },
    });

    for (const sub of warn1Day) {
      this.eventEmitter.emit('subscription.expiring', {
        userId: sub.userId,
        userEmail: sub.user.email,
        userName: `${sub.user.firstName} ${sub.user.lastName}`,
        daysRemaining: 1,
      });
      this.logger.log(`Queued 1-day expiration warning for user ${sub.userId}`);
    }
  }
}
