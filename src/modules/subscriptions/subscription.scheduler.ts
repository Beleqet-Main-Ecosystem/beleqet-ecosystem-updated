import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '../queues/queues.constants';

const SUBSCRIPTION_CHECK_JOB = 'subscription-daily-check';

/**
 * Registers a BullMQ repeatable job on startup that fires once per day.
 * The actual expiration + reminder logic runs inside the processor.
 */
@Injectable()
export class SubscriptionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SCHEDULED)
    private readonly scheduledQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Registers the repeatable cron job when the application starts. */
  async onApplicationBootstrap() {
    await this.scheduledQueue.add(
      SUBSCRIPTION_CHECK_JOB,
      {},
      {
        repeat: { pattern: '0 0 * * *' }, // Every day at midnight
        jobId: 'subscription-daily-check-singleton', // Prevents duplicate registration
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Subscription daily check job registered (cron: 0 0 * * *)');
  }

  /**
   * Called by the ScheduledProcessor when the repeatable job fires.
   * Marks expired subscriptions and emits expiration/reminder events.
   */
  async runDailyCheck() {
    this.logger.log('Running daily subscription check...');
    await this.processExpirations();
    await this.processReminders();
    this.logger.log('Daily subscription check complete.');
  }

  /** Marks ACTIVE subscriptions past their period end as EXPIRED. */
  async processExpirations() {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { lte: now } },
      include: { user: true },
    });

    this.logger.log(`Expiring ${expired.length} subscription(s).`);
    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED', endedAt: now },
      });
      this.eventEmitter.emit('subscription.expired', {
        userId: sub.userId,
        userEmail: sub.user.email,
        userName: `${sub.user.firstName} ${sub.user.lastName}`,
      });
    }
  }

  /** Emits expiration warnings 3 days and 1 day before period end. */
  async processReminders() {
    const now = new Date();

    for (const daysAhead of [3, 1]) {
      const windowStart = new Date(now.getTime() + (daysAhead - 1) * 86_400_000);
      const windowEnd   = new Date(now.getTime() +  daysAhead       * 86_400_000);

      const subs = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: { gte: windowStart, lte: windowEnd },
        },
        include: { user: true },
      });

      for (const sub of subs) {
        this.eventEmitter.emit('subscription.expiring', {
          userId: sub.userId,
          userEmail: sub.user.email,
          userName: `${sub.user.firstName} ${sub.user.lastName}`,
          daysRemaining: daysAhead,
        });
        this.logger.log(`${daysAhead}-day warning queued for user ${sub.userId}`);
      }
    }
  }
}
