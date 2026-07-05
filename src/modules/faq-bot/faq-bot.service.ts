import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { FaqBotMessageRole, FaqKnowledgeEntry } from '@prisma/client';
import { CreateFaqBotSessionDto } from './dto/create-session.dto';
import { QueryClassifierService } from './services/query-classifier.service';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import { AiStreamService } from './services/ai-stream.service';
import { FaqBotConsentService } from './services/faq-bot-consent.service';
import {
  FaqBotCurrencyService,
  SupportedCurrency,
} from './services/faq-bot-currency.service';
import { AiWebhookDto } from './dto/ai-webhook.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface ProcessQuestionResult {
  messageId: string;
  content: string;
  sources: string[];
  usedAi: boolean;
}

export type StreamTokenHandler = (token: string) => void;

/**
 * Orchestrates FAQ Bot sessions: consent, retrieval, AI streaming, and persistence.
 */
@Injectable()
export class FaqBotService {
  private readonly logger = new Logger(FaqBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly classifier: QueryClassifierService,
    private readonly knowledge: KnowledgeRetrievalService,
    private readonly aiStream: AiStreamService,
    private readonly consent: FaqBotConsentService,
    private readonly currency: FaqBotCurrencyService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create a new FAQ Bot session after GDPR consent is recorded.
   * @param dto - Session creation payload
   */
  async createSession(dto: CreateFaqBotSessionDto) {
    if (!dto.consentGiven) {
      throw new BadRequestException(
        this.i18n.t('faq-bot.errors.consentRequired', { lang: dto.locale }),
      );
    }

    const now = new Date();
    const session = await this.prisma.faqBotSession.create({
      data: {
        userId: dto.userId,
        anonymousId: dto.anonymousId,
        locale: dto.locale,
        preferredCurrency: dto.preferredCurrency,
        consentGiven: true,
        consentAt: now,
        expiresAt: this.consent.computeExpiresAt(now),
      },
    });

    const welcome = this.i18n.t('faq-bot.welcome', { lang: dto.locale });

    await this.prisma.faqBotMessage.create({
      data: {
        sessionId: session.id,
        role: FaqBotMessageRole.SYSTEM,
        content: welcome,
      },
    });

    return {
      sessionId: session.id,
      locale: session.locale,
      preferredCurrency: session.preferredCurrency,
      expiresAt: session.expiresAt,
      welcomeMessage: welcome,
    };
  }

  /**
   * Retrieve message history for a session.
   * @param sessionId - FAQ Bot session UUID
   */
  async getMessages(sessionId: string) {
    const session = await this.prisma.faqBotSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('FAQ Bot session not found');
    return session.messages;
  }

  /**
   * Process a user question with hybrid NLP + vector retrieval + AI streaming.
   * @param sessionId - Active session
   * @param message - User question
   * @param onToken - Optional callback for streaming tokens
   */
  async processQuestion(
    sessionId: string,
    message: string,
    onToken?: StreamTokenHandler,
  ): Promise<ProcessQuestionResult> {
    await this.consent.assertConsent(sessionId);

    const session = await this.prisma.faqBotSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('FAQ Bot session not found');

    await this.prisma.faqBotMessage.create({
      data: {
        sessionId,
        role: FaqBotMessageRole.USER,
        content: message.trim(),
      },
    });

    const classification = this.classifier.classify(message);
    let contextEntries: FaqKnowledgeEntry[] = [];
    let usedAi = false;

    if (classification.confidence >= 0.75) {
      const slug = this.classifier.getSlugForIntent(classification.intent);
      if (slug) {
        const entry = await this.knowledge.findBySlug(slug);
        if (entry) contextEntries = [entry];
      }
    }

    if (contextEntries.length === 0) {
      contextEntries = await this.knowledge.findSimilar(message, 5);
      usedAi = true;
    }

    const currencyContext = this.currency.buildCurrencyContext(
      session.locale,
      session.preferredCurrency as SupportedCurrency,
    );

    const enrichedEntries = contextEntries.map((entry) =>
      this.applyCurrencyToEntry(entry, session.locale, session.preferredCurrency as SupportedCurrency),
    );

    let fullContent = '';
    const tokenHandler = (token: string) => {
      fullContent += token;
      onToken?.(token);
    };

    if (classification.confidence >= 0.85 && contextEntries.length === 1 && !usedAi) {
      const { answer } = this.knowledge.localizeEntry(enrichedEntries[0], session.locale);
      fullContent = await this.aiStream.streamStaticText(answer, tokenHandler);
    } else {
      usedAi = true;
      fullContent = await this.aiStream.streamAnswer({
        userQuestion: message,
        contextEntries: enrichedEntries,
        locale: session.locale,
        preferredCurrency: session.preferredCurrency,
        currencyContext,
        onToken: tokenHandler,
      });
    }

    const sources = contextEntries.map((e) => e.slug);
    const assistantMessage = await this.prisma.faqBotMessage.create({
      data: {
        sessionId,
        role: FaqBotMessageRole.ASSISTANT,
        content: fullContent,
        sources: sources.length ? sources : undefined,
      },
    });

    return {
      messageId: assistantMessage.id,
      content: fullContent,
      sources,
      usedAi,
    };
  }

  /**
   * Handle async AI webhook callbacks with HMAC signature verification.
   * @param dto - Webhook payload
   */
  async handleAiWebhook(dto: AiWebhookDto) {
    this.verifyWebhookSignature(dto);

    const session = await this.prisma.faqBotSession.findUnique({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('FAQ Bot session not found');

    const existing = await this.prisma.faqBotMessage.findUnique({ where: { id: dto.messageId } });
    if (existing) {
      return this.prisma.faqBotMessage.update({
        where: { id: dto.messageId },
        data: {
          content: dto.content,
          sources: dto.sources?.length ? dto.sources : undefined,
        },
      });
    }

    return this.prisma.faqBotMessage.create({
      data: {
        id: dto.messageId,
        sessionId: dto.sessionId,
        role: FaqBotMessageRole.ASSISTANT,
        content: dto.content,
        sources: dto.sources?.length ? dto.sources : undefined,
      },
    });
  }

  /**
   * Verify HMAC-SHA256 webhook signature when secret is configured.
   * @param dto - Webhook payload including optional signature
   */
  private verifyWebhookSignature(dto: AiWebhookDto): void {
    const secret = this.config.get<string>('FAQ_BOT_WEBHOOK_SECRET');
    if (!secret) return;

    if (!dto.signature) throw new UnauthorizedException('Missing webhook signature');

    const payload = `${dto.sessionId}:${dto.messageId}:${dto.content}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected !== dto.signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /**
   * Replace currency placeholders in FAQ answers with localized formatted amounts.
   * @param entry - Knowledge base entry
   * @param locale - User locale
   * @param currency - Preferred currency
   */
  private applyCurrencyToEntry(
    entry: FaqKnowledgeEntry,
    locale: string,
    currency: SupportedCurrency,
  ): FaqKnowledgeEntry {
    const format = (etbAmount: number) => this.currency.formatAmount(etbAmount, locale, currency);
    const replaceTokens = (text: string) =>
      text
        .replace(/\{\{MIN_WITHDRAWAL\}\}/g, format(1))
        .replace(/\{\{ESCROW_FEE\}\}/g, '5%');

    return {
      ...entry,
      answerEn: replaceTokens(entry.answerEn),
      answerAm: entry.answerAm ? replaceTokens(entry.answerAm) : entry.answerAm,
    };
  }
}
