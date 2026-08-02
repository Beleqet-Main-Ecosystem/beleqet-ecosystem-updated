import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { CampaignBudgetService } from './campaign-budget.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AD_EVENTS_RETENTION_DAYS, purgeExpiredAdEvents } from './ad-events-retention';

const LOCK_TTL_MS = 5 * 60 * 1000;
const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Daily campaign budget reset cron (pod-safe via Redis SET-NX lock).
 */
@Injectable()
export class CampaignsScheduler {
  private readonly logger = new Logger(CampaignsScheduler.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly budget: CampaignBudgetService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'campaigns-daily-budget-reset' })
  async handleDailyBudgetReset(): Promise<void> {
    await this.withLock('campaigns-daily-budget-reset', async () => {
      const reactivated = await this.budget.resetDailyBudgets();
      this.logger.log(`Campaign daily reset complete; reactivated=${reactivated}`);
    });
  }

  /** GDPR retention: purge ad_events older than AD_EVENTS_RETENTION_DAYS. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'campaigns-ad-events-retention' })
  async handleAdEventsRetention(): Promise<void> {
    await this.withLock('campaigns-ad-events-retention', async () => {
      const deleted = await purgeExpiredAdEvents(async (cutoff) => {
        const result = await this.prisma.adEvent.deleteMany({
          where: { occurredAt: { lt: cutoff } },
        });
        return result.count;
      });
      this.logger.log(
        `Purged ${deleted} ad_event(s) older than ${AD_EVENTS_RETENTION_DAYS} days`,
      );
    });
  }

  private async withLock(name: string, fn: () => Promise<void>): Promise<void> {
    const key = `cron-lock:${name}`;
    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      this.logger.debug(`Skipped ${name}: lock held by another pod`);
      return;
    }
    try {
      await fn();
    } finally {
      await this.redis.eval(UNLOCK_SCRIPT, 1, key, token);
    }
  }
}
