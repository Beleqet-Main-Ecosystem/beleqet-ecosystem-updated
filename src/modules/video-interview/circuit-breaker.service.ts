import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

/** Possible states of a circuit breaker. */
export enum CircuitState {
  /** Normal operation — requests pass through. */
  CLOSED = 'CLOSED',
  /** Too many failures — requests are rejected immediately (fast-fail). */
  OPEN = 'OPEN',
  /** Cooldown expired — one probe request allowed to test recovery. */
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  /** Number of consecutive failures before the circuit opens. Default: 3 */
  failureThreshold: number;
  /** Consecutive successes in HALF_OPEN needed to close the circuit. Default: 2 */
  successThreshold: number;
  /** Milliseconds to wait in OPEN state before transitioning to HALF_OPEN. Default: 30 000 */
  timeout: number;
}

interface CircuitSnapshot {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

/**
 * In-process Circuit Breaker implementation for downstream AI services
 * (Whisper transcription, Ollama evaluation).
 *
 * Usage:
 * ```ts
 * const result = await this.circuitBreaker.execute(
 *   'whisper',
 *   () => this.callWhisperApi(url),
 *   { failureThreshold: 3, timeout: 30_000 },
 *   lang,
 * );
 * ```
 *
 * States:
 * - **CLOSED** → normal, all requests pass through.
 * - **OPEN**   → fast-fail with i18n `video_interview.service_unavailable`.
 * - **HALF_OPEN** → one probe is allowed; success → CLOSED, failure → OPEN.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitSnapshot>();
  private readonly defaults: CircuitBreakerOptions = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30_000,
  };

  constructor(private readonly i18n: I18nService) {}

  /**
   * Execute `action` through the named circuit breaker.
   *
   * @param circuitName  Logical name of the downstream service (e.g. 'whisper').
   * @param action       Async factory that calls the downstream service.
   * @param options      Override default thresholds / timeout.
   * @param lang         BCP-47 locale for i18n error messages.
   * @returns            Result of `action` on success.
   * @throws             {@link ServiceUnavailableException} when circuit is OPEN.
   * @throws             Original error from `action` on failure (re-thrown after recording).
   */
  async execute<T>(
    circuitName: string,
    action: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>,
    lang = 'en',
  ): Promise<T> {
    const opts = { ...this.defaults, ...options };
    const circuit = this.getOrCreate(circuitName);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextRetryTime) {
        const message = await this.i18n.t('video_interview.service_unavailable', { lang });
        this.logger.warn(`[CircuitBreaker] ${circuitName} OPEN — fast-failing`);
        throw new ServiceUnavailableException(message);
      }
      // Cooldown expired — probe with HALF_OPEN
      circuit.state = CircuitState.HALF_OPEN;
      circuit.successCount = 0;
      this.logger.log(`[CircuitBreaker] ${circuitName} → HALF_OPEN`);
    }

    try {
      const result = await action();
      this.recordSuccess(circuitName, circuit, opts);
      return result;
    } catch (err) {
      this.recordFailure(circuitName, circuit, opts, err as Error);
      throw err;
    }
  }

  /**
   * Returns the current state of a named circuit.
   * Returns CLOSED for unknown circuits (they have never failed).
   */
  getState(circuitName: string): CircuitState {
    return this.circuits.get(circuitName)?.state ?? CircuitState.CLOSED;
  }

  /** Manually reset a circuit to CLOSED (useful in tests / admin endpoints). */
  reset(circuitName: string): void {
    this.circuits.delete(circuitName);
    this.logger.log(`[CircuitBreaker] ${circuitName} manually reset → CLOSED`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private recordSuccess(
    name: string,
    circuit: CircuitSnapshot,
    opts: CircuitBreakerOptions,
  ): void {
    circuit.failureCount = 0;
    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      if (circuit.successCount >= opts.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        this.logger.log(`[CircuitBreaker] ${name} → CLOSED (recovered)`);
      }
    }
  }

  private recordFailure(
    name: string,
    circuit: CircuitSnapshot,
    opts: CircuitBreakerOptions,
    err: Error,
  ): void {
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();
    this.logger.error(
      `[CircuitBreaker] ${name} failure #${circuit.failureCount}: ${err.message}`,
    );

    const shouldOpen =
      circuit.state === CircuitState.HALF_OPEN ||
      circuit.failureCount >= opts.failureThreshold;

    if (shouldOpen) {
      circuit.state = CircuitState.OPEN;
      circuit.nextRetryTime = Date.now() + opts.timeout;
      this.logger.warn(
        `[CircuitBreaker] ${name} → OPEN (retry at ${new Date(circuit.nextRetryTime).toISOString()})`,
      );
    }
  }

  private getOrCreate(name: string): CircuitSnapshot {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextRetryTime: 0,
      });
    }
    return this.circuits.get(name)!;
  }
}
