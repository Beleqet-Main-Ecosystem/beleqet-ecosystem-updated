/**
 * @file scheduler.service.ts
 * @description
 * Cron triggers for the Subscription Manager. Kept as a thin layer over
 * SubscriptionsService/NotificationsService so the actual sweep/reminder
 * logic is unit-testable without needing to fire the @Cron decorators.
 *
 * Beleqet runs load-balanced across multiple pods, and @Cron fires on every
 * one of them at the same wall-clock time — without a lock, each pod would
 * fetch the same "due" subscriptions and send duplicate emails. `withLock`
 * guards each job body with a Redis SET-NX mutex (reusing the REDIS_CLIENT
 * already wired for two-factor.service.ts) so only one pod runs it.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';

const LOCK_TTL_MS = 5 * 60 * 1000;
// Compare-and-delete: only releases the lock if it's still the one this run
// acquired, so a run that outlives LOCK_TTL_MS can't release a lock another
// pod has since acquired.
const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Daily sweep: expires any ACTIVE subscription whose period has ended. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'subscriptions-expiry-sweep' })
  async handleExpirySweep(): Promise<void> {
    await this.withLock('subscriptions-expiry-sweep', async () => {
      const expired = await this.subscriptionsService.sweepExpired();
      for (const subscription of expired) {
        await this.notificationsService.sendSubscriptionExpired(
          subscription.userId,
          subscription.planName,
        );
      }
      if (expired.length > 0) {
        this.logger.log(`Expiry sweep: marked ${expired.length} subscription(s) EXPIRED`);
      }
    });
  }

  /** Daily reminder: notifies users whose subscription expires within 3 days. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'subscriptions-expiry-reminder' })
  async handleExpiryReminders(): Promise<void> {
    await this.withLock('subscriptions-expiry-reminder', async () => {
      const due = await this.subscriptionsService.findAndMarkDueForReminder(3);
      for (const subscription of due) {
        await this.notificationsService.sendSubscriptionExpiringSoon(
          subscription.userId,
          subscription.planName,
          subscription.currentPeriodEnd,
        );
      }
      if (due.length > 0) {
        this.logger.log(`Expiry reminders: notified ${due.length} user(s)`);
      }
    });
  }

  /** Runs `fn` only if no other pod currently holds the named lock; otherwise skips it. */
  private async withLock(name: string, fn: () => Promise<void>): Promise<void> {
    const key = `cron-lock:${name}`;
    const token = randomUUID();

    const acquired = await this.redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (!acquired) {
      this.logger.log(`Skipping ${name} — another instance already holds the lock`);
      return;
    }

    try {
      await fn();
    } finally {
      await this.redis.eval(UNLOCK_SCRIPT, 1, key, token);
    }
  }
}
