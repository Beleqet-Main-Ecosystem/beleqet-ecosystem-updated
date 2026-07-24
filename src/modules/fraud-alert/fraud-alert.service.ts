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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { AnomalySensorService } from '../anomaly-sensor/anomaly-sensor.service';
import { PlagiarismService } from '../plagiarism/plagiarism.service';

const DEFAULT_CURRENCY = 'ETB';
const DEFAULT_RETENTION_DAYS = 90;
@Injectable()
export class FraudAlertService {
  private readonly logger = new Logger(FraudAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: I18nService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    private readonly anomalySensor: AnomalySensorService,
    private readonly plagiarismService: PlagiarismService,
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
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '***@***.***');
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
      {
        regex: /(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62})/,
        label: 'Crypto address',
        weight: 40,
      },
      {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
        label: 'Email address',
        weight: 15,
      },
      { regex: /\bpaypal\b/i, label: 'PayPal', weight: 20 },
      { regex: /\bwestern\s+union\b/i, label: 'Western Union', weight: 25 },
      { regex: /\btelebirr\b/i, label: 'Telebirr', weight: 20 },
      { regex: /\bcbe\s*birr\b|\bcommercial\s+bank\b/i, label: 'CBE Birr', weight: 20 },
      { regex: /\bamole\b/i, label: 'Amole', weight: 20 },
      { regex: /\bm[\s-]?pesa\b/i, label: 'M-Pesa', weight: 20 },
      { regex: /\bbank\s*transfer\b/i, label: 'Bank transfer', weight: 15 },
      { regex: /\bsend\s+via\s+telegram\b/i, label: 'Send via Telegram', weight: 20 },
      {
        regex: /(?:በቴሌግራም|ወደ\s*ቴሌግራም)\s*ላክ|ቴሌብር|ሲቢ\s*ኢ\s*ብር|አሞሌ/,
        label: 'Ethiopian payment app (Amharic)',
        weight: 20,
      },
      {
        regex: /በቀጥታ\s*ክፈሉ|ከመደበኛው\s*መንገድ\s*ውጪ\s*ክፍያ/,
        label: 'Off-platform payment (Amharic)',
        weight: 30,
      },
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

  // ── 3. Payment Anomaly Alert Orchestration ──────────────────────────────

  // ── 4. Duplicate Listing Detector ──────────────────────────────────────

  /**
   * Flags job listings using the shared PlagiarismModule similarity pipeline.
   *
   * @param job - The job to check (with description)
   * @param existingJobs - Array of existing jobs from the same company to compare against
   * @returns Object with match details and score
   */
  async detectDuplicateListing(
    job: { id: string; description: string; companyId: string },
    existingJobs: { id: string; title: string; description: string }[],
  ): Promise<{ flags: string[]; score: number; matchIds: string[] }> {
    const flags: string[] = [];
    let score = 0;
    const matchIds: string[] = [];

    const matches = await this.plagiarismService.findSimilarDocuments(
      job.description,
      existingJobs.map((existing) => ({
        id: existing.id,
        entityType: 'Job',
        title: existing.title,
        content: existing.description,
        sourceType: 'platform' as const,
      })),
      0.8,
    );

    for (const match of matches) {
      const similarity = match.similarity;
      if (similarity > 0.8) {
        flags.push(`near_duplicate_of_${match.entityId}`);
        matchIds.push(match.entityId);
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
    options?: { adminIds?: string[] },
  ): Promise<{ id: string }> {
    const sanitizedEvidence = evidence ? this.sanitizeEvidence(evidence) : undefined;

    const expiryAt = new Date(Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

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
    const notificationBody = this.t(`fraud.alert.body.${alert.ruleType}`) || alert.reason;

    const adminIds =
      options?.adminIds ??
      (
        await this.prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
        })
      ).map((admin) => admin.id);

    for (const adminId of adminIds) {
      this.notificationsQueue
        .add(NOTIFICATION_JOBS.SEND_IN_APP, {
          userId: adminId,
          type: 'fraud.alert',
          title: notificationTitle,
          body: `${notificationBody} [Score: ${alert.score}]`,
          metadata: { alertId: result.id, severity: alert.severity },
        })
        .catch((err: Error) => this.logger.error(`Failed to enqueue notification: ${err.message}`));
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
        out[k] = v.map((item) => (typeof item === 'string' ? this.redactPii(item) : item));
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
  async scanUser(
    userId: string,
    options?: { rules?: { id: string }[]; adminIds?: string[] },
  ): Promise<string[]> {
    const alertIds: string[] = [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, candidateScores: true },
    });
    if (!user) return alertIds;

    const rules =
      options?.rules ??
      (await this.prisma.fraudRule.findMany({
        where: { enabled: true, ruleType: 'FAKE_PROFILE' },
      }));

    for (const rule of rules) {
      const result = this.detectFakeProfile(
        {
          emailVerified: user.emailVerified,
          skillVerified: user.skillVerified,
          skills: user.skills,
          company: user.company ? { verified: user.company.verified } : null,
        },
        user.candidateScores,
      );

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
          { adminIds: options?.adminIds },
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
   * Reuses AnomalySensorService's statistical detector for an on-demand scan.
   * Wallet history is already single-currency, so no exchange-rate fallback is
   * applied to unknown currencies.
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

    const normalizedCurrency = wallet.currency || DEFAULT_CURRENCY;
    const [latest, ...history] = wallet.transactions;
    if (!latest) return alertIds;

    const analysis = this.anomalySensor.analyzePaymentAmount(
      latest.amount,
      history.map((transaction) => transaction.amount),
    );
    if (!analysis.anomalous) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'PAYMENT_ANOMALY' },
    });

    for (const rule of rules) {
      const { id } = await this.createAlert(
        {
          entityType: 'WalletTransaction',
          entityId: latest.id,
          userId,
          ruleId: rule.id,
          ruleType: 'PAYMENT_ANOMALY',
          severity: 'HIGH',
          score: 100,
          reason: `Unusual payment amount detected (${normalizedCurrency}); z-score ${analysis.zScore.toFixed(2)}`,
          currency: normalizedCurrency,
        },
        {
          zScore: analysis.zScore,
          meanAmount: analysis.meanAmount,
          currency: normalizedCurrency,
        },
      );
      alertIds.push(id);
    }

    return alertIds;
  }

  /**
   * Reuses AnomalySensorService's statistical detector for escrow scans.
   * Transactions in other currencies are excluded from the baseline rather
   * than converted with a guessed exchange rate.
   *
   * @param userId - The client whose escrow transactions should be scanned
   */
  async scanEscrowTransactions(userId: string): Promise<string[]> {
    const alertIds: string[] = [];

    const escrowTxs = await this.prisma.escrowTransaction.findMany({
      where: { freelanceJob: { clientId: userId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { freelanceJob: { select: { currency: true } } },
    });
    if (escrowTxs.length === 0) return alertIds;

    const latest = escrowTxs[0];
    const currencyOf = (transaction: (typeof escrowTxs)[number]) =>
      transaction.currency || transaction.freelanceJob?.currency || DEFAULT_CURRENCY;
    const normalizedCurrency = currencyOf(latest);
    const history = escrowTxs
      .slice(1)
      .filter((transaction) => currencyOf(transaction) === normalizedCurrency)
      .map((transaction) => transaction.grossAmount);
    const analysis = this.anomalySensor.analyzePaymentAmount(latest.grossAmount, history);
    if (!analysis.anomalous) return alertIds;

    const rules = await this.prisma.fraudRule.findMany({
      where: { enabled: true, ruleType: 'PAYMENT_ANOMALY' },
    });

    for (const rule of rules) {
      const { id } = await this.createAlert(
        {
          entityType: 'EscrowTransaction',
          entityId: latest.id,
          userId,
          ruleId: rule.id,
          ruleType: 'PAYMENT_ANOMALY',
          severity: 'HIGH',
          score: 100,
          reason: `Unusual escrow amount detected (${normalizedCurrency}); z-score ${analysis.zScore.toFixed(2)}`,
          currency: normalizedCurrency,
        },
        {
          zScore: analysis.zScore,
          meanAmount: analysis.meanAmount,
          currency: normalizedCurrency,
        },
      );
      alertIds.push(id);
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
      const result = await this.detectDuplicateListing(job, existingJobs);
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
    const [users, rules, admins] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true, role: { not: 'ADMIN' } },
        select: { id: true },
        skip: options?.skip ?? 0,
        take: options?.take ?? 100,
      }),
      this.prisma.fraudRule.findMany({
        where: { enabled: true, ruleType: 'FAKE_PROFILE' },
        select: { id: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      }),
    ]);

    const adminIds = admins.map((admin) => admin.id);

    let alertCount = 0;
    for (const u of users) {
      const ids = await this.scanUser(u.id, { rules, adminIds });
      alertCount += ids.length;
    }

    this.logger.log(
      `scanAll complete: ${users.length} users checked, ${alertCount} alerts generated`,
    );
    return alertCount;
  }
}
