import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertingService } from './alerting.service';

/**
 * Payload emitted when an authentication attempt fails.
 */
interface AuthFailedPayload {
  /** The email address used in the failed login attempt */
  email: string;
  /** Optional IP address of the requester */
  ip?: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * Payload emitted when an authentication attempt succeeds.
 */
interface AuthSuccessPayload {
  /** The email address used in the successful login */
  email: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * Payload emitted when an escrow payment is initiated.
 */
interface EscrowInitiatedPayload {
  /** The unique identifier of the escrow transaction */
  escrowId: string;
  /** The user ID of the client initiating the payment */
  clientId: string;
  /** The gross amount of the transaction */
  grossAmount: number;
  /** The currency code (e.g., ETB, USD) */
  currency: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * AnomalySensorService - Core anomaly detection engine.
 * Listens to platform events and applies detection rules to identify
 * suspicious activities such as brute-force attacks and unusual payments.
 *
 * Detection methods used:
 * - Rule-based heuristics (auth brute-force sliding window)
 * - Z-Score statistical analysis (payment amount outlier detection)
 *
 * All detected anomalies are:
 * 1. Logged to the secure audit database (EventLog table)
 * 2. Dispatched as alerts via Email and Slack channels
 */
@Injectable()
export class AnomalySensorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnomalySensorService.name);

  /**
   * Maximum number of tracked emails to prevent unbounded memory growth.
   * When this limit is reached, the oldest entry is evicted before adding
   * a new one. This protects against Denial-of-Service attacks where an
   * attacker floods the login endpoint with millions of unique email addresses.
   *
   * NOTE: For horizontally scaled (multi-instance) deployments, this
   * in-memory Map should be replaced with a Redis-backed sliding window
   * (e.g., using REDIS_CLIENT) to ensure brute-force detection works
   * across all instances.
   */
  private static readonly MAX_TRACKED_EMAILS = 10_000;

  /**
   * In-memory sliding window for tracking authentication failures.
   * Maps email address to an array of failure timestamps (epoch ms).
   * Entries older than 5 minutes are automatically pruned on each check.
   * Bounded to MAX_TRACKED_EMAILS to prevent OOM from attacker-controlled input.
   */
  private authFailures: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertingService: AlertingService,
  ) {}

  onModuleInit() {
    // Run cleanup every 5 minutes to prevent memory leaks from one-off failed logins
    this.cleanupInterval = setInterval(() => this.pruneStaleAuthFailures(), 5 * 60 * 1000);
    // Unref the timer so it does not keep the Node.js event loop alive
    // and block process shutdown (same pattern as WalletService fix)
    this.cleanupInterval.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  private pruneStaleAuthFailures() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [email, times] of this.authFailures.entries()) {
      const recent = times.filter(t => t > fiveMinutesAgo);
      if (recent.length === 0) {
        this.authFailures.delete(email);
      } else {
        this.authFailures.set(email, recent);
      }
    }
  }

  /**
   * Listens to failed authentication attempts to detect brute-force
   * or credential stuffing attacks.
   *
   * Detection Rule: If more than 5 failed login attempts occur for
   * the same email within a 5-minute sliding window, an alert is triggered.
   *
   * Memory Safety: The authFailures Map is bounded to MAX_TRACKED_EMAILS.
   * When the limit is reached, the oldest tracked email is evicted to
   * make room for the new entry, preventing OOM from attacker-controlled input.
   *
   * @param payload - The authentication failure event data
   */
  @OnEvent('auth.login.failed')
  async handleAuthFailed(payload: AuthFailedPayload): Promise<void> {
    const { email } = payload;
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Retrieve existing failures and prune entries outside the window
    let failures = this.authFailures.get(email) || [];
    failures = failures.filter((time) => time > fiveMinutesAgo);
    failures.push(now);

    // Evict oldest entry if at capacity and this is a new email
    if (!this.authFailures.has(email) && this.authFailures.size >= AnomalySensorService.MAX_TRACKED_EMAILS) {
      const oldestKey = this.authFailures.keys().next().value;
      if (oldestKey) this.authFailures.delete(oldestKey);
    }

    this.authFailures.set(email, failures);

    if (failures.length > 5) {
      this.logger.warn(`Auth anomaly detected for email: ${email}`);
      await this.logAnomaly('AUTH_BRUTE_FORCE', email, 'User', {
        failures: failures.length,
        window: '5 minutes',
        ip: payload.ip,
      });

      await this.alertingService.dispatchAlert({
        title: 'Authentication Brute Force Attempt',
        message: `Multiple failed login attempts (${failures.length}) detected for ${email} within 5 minutes.`,
        severity: 'HIGH',
        timestamp: new Date().toISOString(),
      });

      // Reset to avoid spamming alerts for the same burst
      this.authFailures.set(email, []);
    }
  }

  /**
   * Clears the failure counter for a user after a successful login.
   * This prevents false positives where a legitimate user who recovered
   * their password would be incorrectly flagged for subsequent typos
   * within the same 5-minute sliding window.
   *
   * @param payload - The authentication success event data
   */
  @OnEvent('auth.login.success')
  handleAuthSuccess(payload: AuthSuccessPayload): void {
    this.authFailures.delete(payload.email);
  }

  /**
   * Listens to escrow payment initiations and detects unusually large
   * transactions using the Z-Score statistical method.
   *
   * Detection Rule: Fetches the client's historical escrow amounts
   * **for the same currency**, computes the mean and standard deviation,
   * then calculates the Z-Score for the current transaction. If Z > 2.5
   * (i.e., the amount is more than 2.5 standard deviations above the
   * mean), an alert is triggered as a potential anomaly.
   *
   * Currency Isolation: Only transactions in the same currency as the
   * incoming payment are used for the statistical baseline. This prevents
   * invalid Z-Scores from mixing different currency units (e.g., ETB vs USD).
   *
   * Requires at least 3 historical transactions in the same currency to
   * produce a meaningful statistical baseline.
   *
   * @param payload - The escrow initiation event data
   */
  @OnEvent('payment.escrow.initiated')
  async handlePaymentInitiated(payload: EscrowInitiatedPayload): Promise<void> {
    const { clientId, grossAmount, escrowId, currency } = payload;

    // Fetch historical transactions for this client in the SAME CURRENCY
    // to compute a meaningful mean and standard deviation
    const history = await this.prisma.escrowTransaction.findMany({
      where: {
        freelanceJob: { clientId },
        id: { not: escrowId },
        status: { in: ['FUNDED', 'RELEASED'] },
        currency,
      },
      select: { grossAmount: true, currency: true },
    });

    if (history.length < 3) {
      // Not enough historical data in this currency for a meaningful Z-Score
      return;
    }

    const amounts = history.map((tx) => tx.grossAmount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev =
      Math.sqrt(
        amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length,
      ) || 1; // Prevent division by zero when all amounts are identical

    const zScore = (grossAmount - mean) / stdDev;

    if (zScore > 2.5) {
      this.logger.warn(
        `Payment anomaly detected for client: ${clientId}, Z-Score: ${zScore.toFixed(2)}`,
      );

      await this.logAnomaly('PAYMENT_UNUSUAL_AMOUNT', clientId, 'User', {
        escrowId,
        amount: grossAmount,
        currency,
        zScore,
        meanAmount: mean,
      });

      await this.alertingService.dispatchAlert({
        title: 'Suspicious Payment Transaction',
        message: `Unusually large transaction initiated by client ${clientId}. Amount: ${grossAmount} ${currency} (Z-Score: ${zScore.toFixed(2)}).`,
        severity: 'CRITICAL',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Securely saves anomaly event logs into the database for future
   * investigation and forensic analysis. Uses the existing EventLog
   * Prisma model to maintain GDPR-compliant audit trails.
   *
   * @param type - The anomaly classification (e.g., AUTH_BRUTE_FORCE)
   * @param entityId - The identifier of the affected entity
   * @param entityType - The type of the affected entity (e.g., User)
   * @param details - Additional context about the detected anomaly
   */
  private async logAnomaly(
    type: string,
    entityId: string,
    entityType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.eventLog.create({
        data: {
          eventType: 'ANOMALY_DETECTED',
          entityId,
          entityType,
          payload: { type, ...details },
          processedBy: AnomalySensorService.name,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to save audit log: ${(error as Error).message}`);
    }
  }
}
