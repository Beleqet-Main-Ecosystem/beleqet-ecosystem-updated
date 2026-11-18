import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * Handles GDPR consent, data retention, export, and erasure for FAQ Bot sessions.
 */
@Injectable()
export class FaqBotConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Calculate session expiry based on configured retention days (GDPR).
   * @param from - Reference date (defaults to now)
   */
  computeExpiresAt(from: Date = new Date()): Date {
    const days = this.config.get<number>('FAQ_BOT_RETENTION_DAYS', 90);
    const expires = new Date(from);
    expires.setDate(expires.getDate() + days);
    return expires;
  }

  /**
   * Ensure the session exists and GDPR consent was granted before processing messages.
   * @param sessionId - FAQ Bot session UUID
   */
  async assertConsent(sessionId: string): Promise<void> {
    const session = await this.prisma.faqBotSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('FAQ Bot session not found');
    if (!session.consentGiven) {
      throw new BadRequestException('GDPR consent is required before using the FAQ Bot');
    }
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('FAQ Bot session has expired');
    }
  }

  /**
   * Export all session data for GDPR data portability.
   * @param sessionId - FAQ Bot session UUID
   */
  async exportSession(sessionId: string) {
    const session = await this.prisma.faqBotSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('FAQ Bot session not found');

    return {
      exportedAt: new Date().toISOString(),
      session: {
        id: session.id,
        locale: session.locale,
        preferredCurrency: session.preferredCurrency,
        consentGiven: session.consentGiven,
        consentAt: session.consentAt,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Delete a session and all messages (right to erasure).
   * @param sessionId - FAQ Bot session UUID
   */
  async deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
    const session = await this.prisma.faqBotSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('FAQ Bot session not found');

    await this.prisma.faqBotSession.delete({ where: { id: sessionId } });
    return { deleted: true };
  }
}
