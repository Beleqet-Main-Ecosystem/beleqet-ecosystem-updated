/**
 * Fraud Alert Service — The Brain & Logic Module
 *
 * Detects suspicious activities (off-platform payments, fake profiles,
 * payment anomalies, duplicate listings) and generates alerts for
 * administrator review. Each detection rule is pluggable and configurable
 * via the FraudRule model.
 *
 * Supports global scaling requirements:
 * - i18n: notification titles/bodies resolved via I18nService (en + am)
 * - GDPR: PII redaction in evidence, data export/delete audit logs, retention expiry
 * - Multi-currency: amount normalization via currency-aware thresholds
 *
 * @module FraudAlertService
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';

const DEFAULT_CURRENCY = 'ETB';
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Exchange-rate factors for normalising amounts to a common base currency.
 * These approximate rates allow anomaly thresholds to be currency-agnostic.
 */
const CURRENCY_FACTORS: Record<string, number> = {
  ETB: 1,
  USD: 125,
  EUR: 135,
  GBP: 160,
  KES: 0.8,
  AED: 34,
};

/** Shape of a rule configuration object stored in FraudRule.config */
interface FraudRuleConfig {
  threshold?: number;
  patterns?: string[];
  maxDailyTx?: number;
  maxDuplicateDistance?: number;
}

@Injectable()
export class FraudAlertService {
  private readonly logger = new Logger(FraudAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: I18nService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  // ─── PII Redaction ─────────────────────────────────────────────────────

  /**
   * Redacts personally identifiable information from a string by replacing
   * phone numbers, email addresses, IBANs, and crypto addresses with masked
   * placeholders. Used before storing evidence to comply with GDPR.
   *
   * @param text - Raw text potentially containing PII
   * @returns Redacted text with PII patterns replaced
   */
  redactPii(text: string): string {
    let out = text;
    out = out.replace(/\b09\d{8}\b/g, '09******');
    out = out.replace(/\+\d{1,3}[\s-]?\d{6,14}/g, '+***-******');
    out = out.replace(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/g, '***IBAN***');
    out = out.replace(/(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62})/g, '***CRYPTO***');
    out = out.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      '***@***.***',
    );
    return out;
  }

  // ── 1. Off-Platform Payment Detector ────────────────────────────────────

  /**
   * Scans chat messages for keywords indicating off-platform payment attempts.
   * Detects phone numbers, emails, IBAN/bank details, crypto addresses, and
   * payment-app references in multiple languages (en + am).
   *
   * @param messageContent - The raw text content of a chat message
   * @returns An array of matched pattern labels with score
   */
  detectOffPlatformPayment(messageContent: string): { matches: string[]; score: number } {
    const matches: string[] = [];
    let score = 0;

    const patterns: { regex: RegExp; label: string; weight: number }[] = [
      { regex: /\b09\d{8}\b/, label: 'Ethiopian phone number', weight: 30 },
      { regex: /\+\d{1,3}[\s-]?\d{6,14}/, label: 'International phone number', weight: 25 },
      { regex: /[A-Z]{2}\d{2}[A-Z0-9]{10,30}/, label: 'IBAN', weight: 35 },
      { regex: /(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62})/, label: 'Crypto address', weight: 40 },
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: 'Email address', weight: 15 },
      { regex: /\bpaypal\b/i, label: 'PayPal', weight: 20 },
      { regex: /\bwestern\s+union\b/i, label: 'Western Union', weight: 25 },
      { regex: /\btelebirr\b/i, label: 'Telebirr', weight: 20 },
      { regex: /\bcbe\s*birr\b|\bcommercial\s+bank\b/i, label: 'CBE Birr', weight: 20 },
      { regex: /\bamole\b/i, label: 'Amole', weight: 20 },
      { regex: /\bm[\s-]?pesa\b/i, label: 'M-Pesa', weight: 20 },
      { regex: /\bbank\s*transfer\b/i, label: 'Bank transfer', weight: 15 },
      { regex: /\bsend\s+via\s+telegram\b/i, label: 'Send via Telegram', weight: 20 },
      { regex: /(?:በቴሌግራም|ወደ\s*ቴሌግራም)\s*ላክ|ቴሌብር|ሲቢ\s*ኢ\s*ብር|አሞሌ/, label: 'Ethiopian payment app (Amharic)', weight: 20 },
      { regex: /በቀጥታ\s*ክፈሉ|ከመደበኛው\s*መንገድ\s*ውጪ\s*ክፍያ/, label: 'Off-platform payment (Amharic)', weight: 30 },
    ];

    for (const { regex, label, weight } of patterns) {
      if (regex.test(messageContent)) {
        matches.push(label);
        score += weight;
      }
    }

    return { matches, score: Math.min(score, 100) };
  }

  // ── 2. Fake Profile Detector ───────────────────────────────────────────

  /**
   * Flags user profiles with verification gaps and skills-vs-evidence
   * mismatches. High-risk signals: unverified email + many skills claimed
   * and no verified company association.
   *
   * @param user - User object with skills, verification flags, and optional company
   * @param candidateScores - Optional array of CandidateScore objects for the user
   * @returns Object containing flags, severity, and total score
   */
  detectFakeProfile(
    user: {
      emailVerified: boolean;
      skillVerified: boolean;
      skills?: string[];
      company?: { verified: boolean } | null;
    },
    candidateScores?: { overallScore: number; skillScore: number }[],
  ): { flags: string[]; score: number } {
    const flags: string[] = [];
    let score = 0;

    if (!user.emailVerified) {
      flags.push('email_not_verified');
      score += 15;
    }

    if (!user.skillVerified) {
      flags.push('skill_not_verified');
      score += 10;
    }

    const skillCount = user.skills?.length ?? 0;
    if (skillCount > 8 && !user.skillVerified && !user.emailVerified) {
      flags.push('many_skills_no_verification');
      score += 30;
    }

    if (skillCount > 15 && !user.skillVerified) {
      flags.push('excessive_unverified_skills');
      score += 25;
    }

    if (!user.company || !user.company.verified) {
      flags.push('no_verified_company');
      score += 10;
    }

    if (candidateScores && candidateScores.length > 0) {
      const avgOverall =
        candidateScores.reduce((sum, s) => sum + s.overallScore, 0) / candidateScores.length;
      const avgSkill =
        candidateScores.reduce((sum, s) => sum + s.skillScore, 0) / candidateScores.length;

      if (avgOverall < 30 && skillCount > 5) {
        flags.push('low_scores_high_claim');
        score += 20;
      }
      if (avgSkill < 25 && skillCount > 3) {
        flags.push('skill_score_mismatch');
        score += 15;
      }
    }

    return { flags, score: Math.min(score, 100) };
  }

  // ── 3. Payment Anomaly Detector ────────────────────────────────────────

  /**
   * Normalises a raw integer amount to a common base for comparison
   * across different currencies.
   *
   * @param amount - Raw amount in minor units (e.g. ETB cents, USD cents)
   * @param currency - ISO 4217 currency code
   * @returns Normalised amount in ETB-equivalent units
   */
  private normalizeAmount(amount: number, currency: string): number {
    const factor = CURRENCY_FACTORS[currency.toUpperCase()];
    if (!factor) return amount;
    return Math.round(amount * factor);
  }

  /**
   * Detects unusual payment patterns: high-velocity transactions in a short
   * window, repeated exact round-number amounts (currency-aware), refund
   * loops, and multiple gateway failures.
   *
   * @param transactions - Array of wallet/escrow transactions to analyse
   * @param currency - The currency code for normalising thresholds
   * @returns Object containing anomaly flags and score
   */
  detectPaymentAnomaly(
    transactions: { type: string; amount: number; createdAt: string | Date; gatewayResponse?: unknown }[],
    currency: string = DEFAULT_CURRENCY,
  ): { flags: string[]; score: number } {
    const flags: string[] = [];
    let score = 0;
    const factor = CURRENCY_FACTORS[currency.toUpperCase()] ?? 1;

    const now = Date.now();
    const recent24h = transactions.filter(
      (t) => now - new Date(t.createdAt).getTime() < 24 * 60 * 60 * 1000,
    );

    if (recent24h.length > 20) {
      flags.push('high_velocity_24h');
      score += 30;
    } else if (recent24h.length > 10) {
      flags.push('elevated_velocity_24h');
      score += 15;
    }

    const roundThreshold = Math.max(10, Math.round(10 * factor));
    const roundAmounts = recent24h.filter((t) => this.normalizeAmount(t.amount, currency) % roundThreshold === 0);
    if (roundAmounts.length > 5) {
      flags.push('repeated_round_amounts');
      score += 20;
    }

    const refunds = recent24h.filter((t) => t.type === 'DEBIT_FEE');
    if (refunds.length > 3) {
      flags.push('refund_loop_suspected');
      score += 25;
    }

    const gatewayFailures = transactions.filter(
      (t) => {
        try {
          const resp =
            typeof t.gatewayResponse === 'string'
              ? JSON.parse(t.gatewayResponse)
              : t.gatewayResponse;
          return resp && (resp.status === 'failed' || resp.error);
        } catch {
          return false;
        }
      },
    );
    if (gatewayFailures.length > 5) {
      flags.push('multiple_gateway_failures');
      score += 20;
    }

    return { flags, score: Math.min(score, 100) };
  }

  // ── 4. Duplicate Listing Detector ──────────────────────────────────────

  /**
   * Computes a simple similarity score between two text strings using a
   * bigram-based method. Returns a value between 0 and 1 where 1 means
   * identical content.
   *
   * @param a - First text to compare
   * @param b - Second text to compare
   * @returns Similarity score from 0 to 1
   */
  private textSimilarity(a: string, b: string): number {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const sa = normalize(a);
    const sb = normalize(b);

    if (sa === sb) return 1.0;
    if (!sa || !sb) return 0;

    const bigramsA = new Set<string>();
    for (let i = 0; i < sa.length - 1; i++) {
      bigramsA.add(sa.substring(i, i + 2));
    }
    const bigramsB = new Set<string>();
    for (let i = 0; i < sb.length - 1; i++) {
      bigramsB.add(sb.substring(i, i + 2));
    }

    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Flags job listings that are near-duplicates of other active listings
   * from the same company within a recent time window.
   *
   * @param job - The job to check (with description)
   * @param existingJobs - Array of existing jobs from the same company to compare against
   * @returns Object with match details and score
   */
  detectDuplicateListing(
    job: { id: string; description: string; companyId: string },
    existingJobs: { id: string; title: string; description: string }[],
  ): { flags: string[]; score: number; matchIds: string[] } {
    const flags: string[] = [];
    let score = 0;
    const matchIds: string[] = [];

    for (const existing of existingJobs) {
      if (existing.id === job.id) continue;

      const similarity = this.textSimilarity(job.description, existing.description);
      if (similarity > 0.8) {
        flags.push(`near_duplicate_of_${existing.id}`);
        matchIds.push(existing.id);
        score += similarity > 0.95 ? 50 : 35;
      }
    }

    return { flags, score: Math.min(score, 100), matchIds };
  }

  // ── 5. Alert Persistence & Notification ────────────────────────────────

  /**
   * Resolves an i18n key to a translated string using the current lang
   * context, falling back to English.
   *
   * @param key - Dot-separated i18n key
   * @param args - Optional interpolation arguments
   * @returns Resolved translation string
   */
  private t(key: string, args?: Record<string, unknown>): string {
    try {
      const lang = I18nContext.current()?.lang ?? 'en';
      return this.i18n.t(key, { lang, args }) as string;
    } catch {
      return key;
    }
  }

  /**
   * Creates a fraud alert record and writes to the event log atomically
   * inside a Prisma transaction, then enqueues i18n-aware in-app
   * notifications for all admin users. Evidence PII is redacted before
   * storage. A GDPR retention expiry is set automatically.
   *
   * @param alert - The alert data to persist
   * @param evidence - Optional evidence payload (will be PII-redacted)
   * @returns Created alert ID
   */
  async createAlert(
    alert: {
      entityType: string;
      entityId: string;
      userId?: string;
      ruleId?: string;
      ruleType: string;
      severity: string;
      score: number;
      reason: string;
      currency?: string;
    },
    evidence?: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const sanitizedEvidence = evidence
      ? this.sanitizeEvidence(evidence)
      : undefined;

    const expiryAt = new Date(
      Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fraudAlert.create({
        data: {
          entityType: alert.entityType,
          entityId: alert.entityId,
          userId: alert.userId,
          ruleId: alert.ruleId,
          ruleType: alert.ruleType as never,
          severity: alert.severity as never,
          score: alert.score,
          reason: alert.reason,
          evidence: sanitizedEvidence as never,
          currency: alert.currency ?? DEFAULT_CURRENCY,
          status: 'OPEN',
          legalBasis: 'legitimate_interest',
          expiryAt,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'fraud.alert.created',
          entityId: created.id,
          entityType: 'FraudAlert',
          payload: {
            ruleType: alert.ruleType,
            severity: alert.severity,
            score: alert.score,
          } as never,
          processedBy: FraudAlertService.name,
        },
      });

      return created;
    });

    const notificationTitle = this.t(`fraud.alert.title.${alert.ruleType}`, {
      args: { score: alert.score },
    });
    if (!notificationTitle.startsWith('fraud.')) {
      const notificationBody =
        this.t(`fraud.alert.body.${alert.ruleType}`) || alert.reason;

      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        this.notificationsQueue
          .add(NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: admin.id,
            type: 'fraud.alert',
            title: notificationTitle,
            body: `${notificationBody} [Score: ${alert.score}]`,
            metadata: { alertId: result.id, severity: alert.severity },
          })
          .catch((err: Error) =>
            this.logger.error(`Failed to enqueue notification: ${err.message}`),
          );
      }
    }

    this.eventEmitter.emit('fraud.alert.created', {
      alertId: result.id,
      ruleType: alert.ruleType,
      severity: alert.severity,
    });

    return { id: result.id };
  }

  /**
   * Recursively redacts PII from any string values inside the evidence
   * payload before storage.
   *
   * @param evidence - Raw evidence payload
   * @returns Sanitized evidence with PII redacted
   */
  private sanitizeEvidence(evidence: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(evidence)) {
      if (typeof v === 'string') {
        out[k] = this.redactPii(v);
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) =>
          typeof item === 'string' ? this.redactPii(item) : item,
        );
      } else {
        out[k] = v;
      }
    }
    out.redacted = true;
    return out;
  }

  /**
   * Resolves a fraud alert by updating its status, attaching the admin
   * resolver, writing an event log entry, and notifying the affected user
   * via an i18n-aware in-app notification.
   *
   * @param alertId - The fraud alert to resolve
   * @param status - New status (RESOLVED | FALSE_POSITIVE | CONFIRMED)
   * @param adminId - The admin user resolving the alert
   * @param resolutionNote - Optional resolution explanation
   */
  async resolveAlert(
    alertId: string,
    status: 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED',
    adminId: string,
    resolutionNote?: string,
  ): Promise<void> {
    const alert = await this.prisma.fraudAlert.findUnique({
      where: { id: alertId },
      select: { userId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.fraudAlert.update({
        where: { id: alertId },
        data: {
          status: status as never,
          resolvedById: adminId,
          resolvedAt: new Date(),
          resolutionNote,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: `fraud.alert.${status.toLowerCase()}`,
          entityId: alertId,
          entityType: 'FraudAlert',
          payload: {
            resolvedBy: adminId,
            resolutionNote,
          } as never,
          processedBy: FraudAlertService.name,
        },
      });
    });

    if (alert?.userId) {
      const i18nKey =
        status === 'RESOLVED'
          ? 'fraud.notification.user_resolved'
          : status === 'FALSE_POSITIVE'
            ? 'fraud.notification.user_false_positive'
            : 'fraud.notification.user_confirmed';

      const userNotificationBody = this.t(i18nKey);

      this.notificationsQueue
        .add(NOTIFICATION_JOBS.SEND_IN_APP, {
          userId: alert.userId,
          type: 'fraud.alert.resolved',
          title: this.t('fraud.notification.prefix'),
          body: userNotificationBody,
          metadata: { alertId, status },
        })
        .catch((err: Error) =>
          this.logger.error(`Failed to notify user of resolution: ${err.message}`),
        );
    }

    this.eventEmitter.emit('fraud.alert.resolved', { alertId, status, adminId });
  }

  // ── 6. GDPR Compliance ────────────────────────────────────────────────

  /**
   * Exports all fraud alert data for a given user, recording a GDPR audit
   * log entry. Evidence is returned with PII already redacted at storage
   * time.
   *
   * @param userId - The data subject's user ID
   * @param adminId - The admin performing the export
   * @returns Collection of fraud alerts related to the user
   */
  async gdprExport(userId: string, adminId: string): Promise<unknown> {
    const alerts = await this.prisma.fraudAlert.findMany({
      where: { OR: [{ userId }, { resolvedById: userId }] },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.eventLog.create({
      data: {
        eventType: 'gdpr.export.fraud_alerts',
        entityId: userId,
        entityType: 'User',
        payload: {
          exportedBy: adminId,
          alertCount: alerts.length,
          timestamp: new Date().toISOString(),
        } as never,
        processedBy: FraudAlertService.name,
      },
    });

    return { userId, alertCount: alerts.length, alerts };
  }

  /**
   * Soft-deletes all fraud alert records for a given user (right to
   * erasure). Sets deletedAt timestamp and writes a GDPR audit log entry.
   *
   * @param userId - The data subject's user ID
   * @param adminId - The admin performing the deletion
   * @returns Count of deleted records
   */
  async gdprDelete(userId: string, adminId: string): Promise<{ deleted: number }> {
    const result = await this.prisma.fraudAlert.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.eventLog.create({
      data: {
        eventType: 'gdpr.delete.fraud_alerts',
        entityId: userId,
        entityType: 'User',
        payload: {
          deletedBy: adminId,
          deletedCount: result.count,
          timestamp: new Date().toISOString(),
        } as never,
        processedBy: FraudAlertService.name,
      },
    });

    return { deleted: result.count };
  }

  // ── 7. Orchestrator Scans ──────────────────────────────────────────────

  /**
   * Runs all applicable detection rules against a single user.
   *
   * @param userId - The user to scan
   */
  async scanUser(userId: string): Promise<string[]> {
    const alertIds: string[] = [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'FAKE_PROFILE' },
    });

    for (const rule of rules) {
      const result = this.detectFakeProfile({
        emailVerified: user.emailVerified,
        skillVerified: user.skillVerified,
        skills: user.skills,
        company: user.company ? { verified: user.company.verified } : null,
      });

      if (result.score > 0) {
        const severity = result.score >= 70 ? 'HIGH' : result.score >= 40 ? 'MEDIUM' : 'LOW';
        const { id } = await this.createAlert(
          {
            entityType: 'User',
            entityId: userId,
            userId,
            ruleId: rule.id,
            ruleType: 'FAKE_PROFILE',
            severity,
            score: result.score,
            reason: result.flags.join('; '),
          },
          { flags: result.flags },
        );
        alertIds.push(id);
      }
    }

    return alertIds;
  }

  /**
   * Runs off-platform payment detection against a single chat message.
   * Message content in evidence is PII-redacted before storage.
   *
   * @param messageId - The message to scan
   */
  async scanMessage(messageId: string): Promise<string[]> {
    const alertIds: string[] = [];

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { room: { include: { participants: true } }, sender: true },
    });
    if (!message) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'OFF_PLATFORM_PAYMENT' },
    });

    const redactedContent = this.redactPii(message.content);

    for (const rule of rules) {
      const result = this.detectOffPlatformPayment(message.content);
      if (result.score > 0) {
        const severity = result.score >= 60 ? 'HIGH' : result.score >= 35 ? 'MEDIUM' : 'LOW';
        const { id } = await this.createAlert(
          {
            entityType: 'Message',
            entityId: messageId,
            userId: message.senderId,
            ruleId: rule.id,
            ruleType: 'OFF_PLATFORM_PAYMENT',
            severity,
            score: result.score,
            reason: `Off-platform payment keywords detected: ${result.matches.join(', ')}`,
          },
          { matches: result.matches, chatRoomId: message.roomId, redactedContent },
        );
        alertIds.push(id);
      }
    }

    return alertIds;
  }

  /**
   * Scans a batch of recent wallet transactions for payment anomalies.
   * Uses currency-aware normalisation for cross-currency analysis.
   *
   * @param userId - The wallet owner to scan
   */
  async scanTransaction(userId: string): Promise<string[]> {
    const alertIds: string[] = [];

    const wallet = await this.prisma.freelancerWallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!wallet) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'PAYMENT_ANOMALY' },
    });

    const normalizedCurrency = wallet.currency || DEFAULT_CURRENCY;

    for (const rule of rules) {
      const result = this.detectPaymentAnomaly(
        wallet.transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          createdAt: t.createdAt.toISOString(),
        })),
        normalizedCurrency,
      );

      if (result.score > 0) {
        const severity = result.score >= 60 ? 'HIGH' : result.score >= 35 ? 'MEDIUM' : 'LOW';
        const { id } = await this.createAlert(
          {
            entityType: 'WalletTransaction',
            entityId: wallet.id,
            userId,
            ruleId: rule.id,
            ruleType: 'PAYMENT_ANOMALY',
            severity,
            score: result.score,
            reason: `Payment anomalies detected (${normalizedCurrency}): ${result.flags.join('; ')}`,
            currency: normalizedCurrency,
          },
          { flags: result.flags, currency: normalizedCurrency },
        );
        alertIds.push(id);
      }
    }

    return alertIds;
  }

  /**
   * Scans a job listing for duplicate content from the same company.
   *
   * @param jobId - The job to scan for duplicates
   */
  async scanJob(jobId: string): Promise<string[]> {
    const alertIds: string[] = [];

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, description: true, companyId: true },
    });
    if (!job) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'DUPLICATE_LISTING' },
    });

    const existingJobs = await this.prisma.job.findMany({
      where: {
        companyId: job.companyId,
        id: { not: job.id },
        status: { in: ['PUBLISHED', 'DRAFT'] },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, description: true },
    });

    for (const rule of rules) {
      const result = this.detectDuplicateListing(job, existingJobs);
      if (result.score > 0) {
        const severity = result.score >= 75 ? 'HIGH' : 'MEDIUM';
        const { id } = await this.createAlert(
          {
            entityType: 'Job',
            entityId: jobId,
            ruleId: rule.id,
            ruleType: 'DUPLICATE_LISTING',
            severity,
            score: result.score,
            reason: `Duplicate listing detected: matches ${result.matchIds.join(', ')}`,
          },
          { matchIds: result.matchIds },
        );
        alertIds.push(id);
      }
    }

    return alertIds;
  }

  /**
   * Batch scan of recent active users for fake profile signals.
   * Designed to be run on a schedule (hourly).
   *
   * @param options - Optional pagination constraints
   * @returns Count of alerts generated
   */
  async scanAll(options?: { skip?: number; take?: number }): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
      select: { id: true },
      skip: options?.skip ?? 0,
      take: options?.take ?? 100,
    });

    let alertCount = 0;
    for (const u of users) {
      const ids = await this.scanUser(u.id);
      alertCount += ids.length;
    }

    this.logger.log(`scanAll complete: ${users.length} users checked, ${alertCount} alerts generated`);
    return alertCount;
  }
}
