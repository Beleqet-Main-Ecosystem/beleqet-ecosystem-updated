/**
 * @file error-recurrence-tracker.service.ts
 * @description
 * In-memory sliding-window tracker that detects when the same error code
 * fires repeatedly within a configurable time window.
 *
 * When a threshold is breached the service logs a CRITICAL alert (and can
 * easily be extended to send a Telegram / email notification via the
 * existing TelegramService or nodemailer integration).
 *
 * Design choices:
 *  - Purely in-memory with a Map<errorCode, timestamp[]> — zero external
 *    dependencies, works in every environment.
 *  - Old timestamps outside the window are pruned on each track() call so
 *    memory stays bounded.
 *  - All tracking is synchronous (no async I/O) so the filter's hot path
 *    is not blocked.
 *  - For multi-instance deployments, swap the Map for a Redis ZSET;
 *    the interface stays identical.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from './all-exceptions.filter';

/** One occurrence recorded in the sliding window. */
interface ErrorOccurrence {
  /** Epoch milliseconds of the occurrence. */
  timestamp: number;
  /** URL path that triggered the error. */
  path: string;
  /** Truncated internal message (max 200 chars, no PII). */
  message: string;
}

/** Public snapshot of a single error code's recent activity. */
export interface RecurrenceSnapshot {
  errorCode: ErrorCode;
  /** Total hits inside the current window. */
  hitCount: number;
  /** Whether the alert threshold has been breached. */
  alertTriggered: boolean;
  /** Most recent occurrence timestamps (ISO strings). */
  recentTimestamps: string[];
  /** Most frequently affected paths. */
  topPaths: string[];
}

const DEFAULT_WINDOW_MS  = 5 * 60 * 1_000; // 5 minutes
const DEFAULT_THRESHOLD  = 10;              // alerts after 10 hits in window
const MAX_OCCURRENCES    = 500;             // cap per-code history to save memory
const MESSAGE_MAX_LEN    = 200;             // truncate long messages

@Injectable()
export class ErrorRecurrenceTrackerService {
  private readonly logger = new Logger(ErrorRecurrenceTrackerService.name);

  /** Sliding-window store: errorCode → list of occurrences. */
  private readonly store = new Map<ErrorCode, ErrorOccurrence[]>();

  /** Set of error codes whose alert has already been logged this window. */
  private readonly alerted = new Set<ErrorCode>();

  /**
   * @param windowMs   Sliding-window duration in milliseconds (default 5 min).
   * @param threshold  Number of hits in window before an alert fires.
   */
  constructor(
    private readonly windowMs: number  = DEFAULT_WINDOW_MS,
    private readonly threshold: number = DEFAULT_THRESHOLD,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Record one occurrence of an error.
   * Prunes old entries, then checks whether the alert threshold is breached.
   *
   * @param errorCode  The i18n error code from AllExceptionsFilter.
   * @param path       URL path (already PII-scrubbed by the filter).
   * @param message    Internal error message (truncated for safety).
   */
  track(errorCode: ErrorCode, path: string, message: string): void {
    const now = Date.now();

    // Initialise if first occurrence
    if (!this.store.has(errorCode)) {
      this.store.set(errorCode, []);
    }

    const occurrences = this.store.get(errorCode)!;

    // Prune entries outside the window
    const cutoff = now - this.windowMs;
    const fresh  = occurrences.filter((o) => o.timestamp >= cutoff);

    // Add current occurrence (cap to MAX_OCCURRENCES)
    fresh.push({
      timestamp: now,
      path,
      message: message.substring(0, MESSAGE_MAX_LEN),
    });

    if (fresh.length > MAX_OCCURRENCES) {
      fresh.splice(0, fresh.length - MAX_OCCURRENCES);
    }

    this.store.set(errorCode, fresh);

    // ── Alert logic ────────────────────────────────────────────────────────
    if (fresh.length >= this.threshold) {
      this.triggerAlert(errorCode, fresh, now);
    } else {
      // Reset alert flag once we drop back below threshold
      this.alerted.delete(errorCode);
    }
  }

  /**
   * Return a snapshot of the current error-recurrence state for all tracked
   * error codes within the sliding window.
   */
  getSnapshot(): RecurrenceSnapshot[] {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const snapshots: RecurrenceSnapshot[] = [];

    for (const [code, occurrences] of this.store.entries()) {
      const fresh = occurrences.filter((o) => o.timestamp >= cutoff);
      if (fresh.length === 0) continue;

      snapshots.push({
        errorCode:        code,
        hitCount:         fresh.length,
        alertTriggered:   this.alerted.has(code),
        recentTimestamps: fresh
          .slice(-5)
          .map((o) => new Date(o.timestamp).toISOString()),
        topPaths: this.topN(fresh.map((o) => o.path), 3),
      });
    }

    return snapshots.sort((a, b) => b.hitCount - a.hitCount);
  }

  /**
   * Return recurrence data for a specific error code.
   * Returns null if the code has no recent hits.
   */
  getByCode(errorCode: ErrorCode): RecurrenceSnapshot | null {
    const all = this.getSnapshot();
    return all.find((s) => s.errorCode === errorCode) ?? null;
  }

  /**
   * Clear all stored occurrences and alerts.
   * Useful for tests or scheduled maintenance resets.
   */
  reset(): void {
    this.store.clear();
    this.alerted.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fire an alert log when a threshold is breached.
   * De-duplicated: only logs once per window per code.
   *
   * Extension point: inject TelegramService / EventEmitter2 here to send
   * real-time alerts to the on-call channel.
   */
  private triggerAlert(
    errorCode: ErrorCode,
    occurrences: ErrorOccurrence[],
    now: number,
  ): void {
    if (this.alerted.has(errorCode)) return; // already alerted this window

    this.alerted.add(errorCode);

    const topPaths = this.topN(occurrences.map((o) => o.path), 3);

    this.logger.error(
      JSON.stringify({
        level:     'CRITICAL',
        alert:     'RECURRING_ERROR_THRESHOLD_BREACHED',
        errorCode,
        hitCount:  occurrences.length,
        windowMs:  this.windowMs,
        threshold: this.threshold,
        topPaths,
        detectedAt: new Date(now).toISOString(),
      }),
    );

    // TODO: inject EventEmitter2 and emit 'error.recurring' so
    // TelegramService / EmailService can send an ops alert.
    // this.eventEmitter.emit('error.recurring', { errorCode, hitCount: occurrences.length });
  }

  /**
   * Return the top-N most frequent strings from an array.
   */
  private topN(items: string[], n: number): string[] {
    const freq = new Map<string, number>();
    for (const item of items) {
      freq.set(item, (freq.get(item) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([val]) => val);
  }
}
