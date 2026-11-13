import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isDeliverableEmail } from '../../common/utils/deliverable-email';

/** Telegram's username rules; anything else (or none) is stored as null. */
export function cleanTelegramUsername(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim().replace(/^@/, '') : '';
  return /^[A-Za-z0-9_]{4,32}$/.test(name) ? name : null;
}

/**
 * Attaches a Telegram account to a Beleqet account whose owner has proved who they are (signed in
 * on the website, or confirmed its email with a code in the bot). The Telegram account may already
 * have an account of its own, made by opening the website from Telegram: when that one is empty
 * (no real email, no applications, bids, projects, company or CV) it is switched off and the link
 * moves over. One with activity is never merged here.
 */
export async function linkTelegram(
  prisma: PrismaService,
  userId: string,
  telegram: { id: number | string; username?: string | null },
) {
  const telegramId = String(telegram.id);
  const holder = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      id: true,
      email: true,
      defaultResumeUrl: true,
      company: { select: { id: true } },
      _count: {
        select: {
          applications: true,
          bids: true,
          freelanceJobs: true,
          contractsAsClient: true,
          contractsAsFreelancer: true,
        },
      },
    },
  });

  const username = cleanTelegramUsername(telegram.username);
  if (holder?.id === userId) {
    if (username)
      await prisma.user.update({ where: { id: userId }, data: { telegramUsername: username } });
    return { linked: true, telegramId, moved: false };
  }

  if (holder) {
    const empty =
      !isDeliverableEmail(holder.email) &&
      !holder.defaultResumeUrl &&
      !holder.company &&
      Object.values(holder._count).every((count) => count === 0);
    if (!empty) {
      throw new ConflictException(
        'This Telegram account already has its own Beleqet account with activity. Keep using that one from Telegram, or contact support to combine them.',
      );
    }
  }

  await prisma.$transaction([
    ...(holder
      ? [
          prisma.user.update({
            where: { id: holder.id },
            data: { telegramId: null, telegramUsername: null, isActive: false },
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: { telegramId, telegramUsername: username },
    }),
  ]);
  return { linked: true, telegramId, moved: Boolean(holder) };
}
