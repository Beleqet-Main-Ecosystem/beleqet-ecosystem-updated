import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[\w-]+\]$/;

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/**
 * Where a notification should open in the mobile app, from what its metadata names. Keep in step
 * with the app's notifications screen (apps/mobile/app/notifications.tsx).
 */
export function pushPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const id = (key: string) => (typeof m[key] === 'string' && m[key] ? encodeURIComponent(m[key] as string) : null);
  if (typeof m.path === 'string' && m.path.startsWith('/') && !m.path.startsWith('//')) return m.path;
  if (id('contractId')) return `/contract/${id('contractId')}`;
  if (id('roomId')) return `/chat/${id('roomId')}`;
  if (id('freelanceJobId')) return `/gig/${id('freelanceJobId')}`;
  if (id('gigId')) return `/gig/${id('gigId')}`;
  if (id('applicationId')) return '/applications';
  if (id('interviewId')) return '/interviews';
  if (id('paymentId')) return '/plan';
  if (id('jobId')) return `/job/${id('jobId')}`;
  return null;
}

/**
 * Push notifications to the mobile app through Expo's push service. Each in-app notification is also
 * pushed to the person's phones, unless they turned in-app notifications off. Sending never fails
 * the caller: a problem is logged and the in-app notification still stands.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Stores this phone's token for the user; a token moves to whoever signed in on it last. */
  async register(userId: string, token: string, platform = 'android') {
    if (!TOKEN_PATTERN.test(token)) throw new BadRequestException('Not an Expo push token.');
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { registered: true };
  }

  /** Signing out on a phone stops its notifications. */
  async remove(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
    return { removed: true };
  }

  /** Sends one notification to every phone the user is signed in on. */
  async sendToUser(userId: string, message: { title: string; body: string; metadata?: unknown }): Promise<void> {
    try {
      const [tokens, pref] = await Promise.all([
        this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } }),
        this.prisma.notificationPreference.findUnique({ where: { userId }, select: { inAppEnabled: true } }),
      ]);
      if (tokens.length === 0 || pref?.inAppEnabled === false) return;
      const path = pushPath(message.metadata);
      const messages = tokens.map(({ token }) => ({
        to: token,
        title: message.title,
        body: message.body,
        sound: 'default',
        channelId: 'default',
        data: path ? { path } : {},
      }));
      for (let start = 0; start < messages.length; start += BATCH) {
        await this.deliver(messages.slice(start, start + BATCH));
      }
    } catch (error) {
      this.logger.warn(`Push to ${userId} failed: ${(error as Error).message}`);
    }
  }

  private async deliver(messages: { to: string }[]) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) throw new Error(`Expo push answered ${response.status}`);
    const { data } = (await response.json()) as { data?: Ticket[] };
    // A phone that uninstalled the app (or turned notifications off for good) is forgotten.
    const gone = (data ?? [])
      .map((ticket, index) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? messages[index]?.to : null))
      .filter((token): token is string => Boolean(token));
    if (gone.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
  }
}
