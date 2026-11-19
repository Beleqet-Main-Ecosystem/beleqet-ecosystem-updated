/**
 * Bounded, retrying HTTP health check.
 *
 * Used by the deploy workflow (via `ts-node tools/ci/health-check.ts <url>`)
 * to verify staging endpoints from the runner after a deployment, and unit
 * tested with an injected fetch implementation. Configuration errors (bad URL,
 * nonsensical bounds) fail immediately without retrying; only transient
 * network errors and non-2xx responses are retried, up to `maxAttempts`.
 */

import { isValidHttpUrl } from './environment-validator';
import type { HealthCheckOptions, HealthCheckResult } from './types';

/** Minimal slice of the WHATWG fetch response the checker needs. */
export interface MinimalResponse {
  readonly status: number;
}

/** Injectable fetch signature (subset of global fetch). */
export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<MinimalResponse>;

/** Injectable sleep for tests; defaults to a real timer. */
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Probe `options.url` until a 2xx response, the attempt budget is exhausted,
 * or a non-retryable configuration error is detected.
 *
 * Never throws: every outcome is reported as a {@link HealthCheckResult} whose
 * `detail` is log-safe (no response bodies, no credentials).
 */
export async function runHealthCheck(
  options: HealthCheckOptions,
  fetchImpl: FetchLike = globalThis.fetch,
  sleep: SleepFn = defaultSleep,
): Promise<HealthCheckResult> {
  if (!isValidHttpUrl(options.url)) {
    return {
      healthy: false,
      attempts: 0,
      detail: 'Configuration error: health-check URL is not an absolute http(s) URL',
    };
  }
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    return {
      healthy: false,
      attempts: 0,
      detail: 'Configuration error: maxAttempts must be a positive integer',
    };
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    return {
      healthy: false,
      attempts: 0,
      detail: 'Configuration error: timeoutMs must be a positive number',
    };
  }

  let lastStatus: number | undefined;
  let lastError = 'no attempt made';

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetchImpl(options.url, { signal: controller.signal });
      lastStatus = response.status;
      if (response.status >= 200 && response.status < 300) {
        return {
          healthy: true,
          attempts: attempt,
          lastStatus: response.status,
          detail: `Healthy: HTTP ${response.status} on attempt ${attempt}`,
        };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      // Network failure or timeout — transient by definition; retry.
      lastError =
        error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network error';
    } finally {
      clearTimeout(timer);
    }
    if (attempt < options.maxAttempts) {
      await sleep(options.retryDelayMs);
    }
  }

  return {
    healthy: false,
    attempts: options.maxAttempts,
    lastStatus,
    detail: `Unhealthy after ${options.maxAttempts} attempts (last outcome: ${lastError})`,
  };
}

/* istanbul ignore next — thin CLI wrapper; logic above is fully unit-tested. */
if (require.main === module) {
  const url = process.argv[2] ?? '';
  const maxAttempts = Number(process.argv[3] ?? '10');
  const timeoutMs = Number(process.argv[4] ?? '5000');
  const retryDelayMs = Number(process.argv[5] ?? '3000');
  void runHealthCheck({ url, maxAttempts, timeoutMs, retryDelayMs }).then((result) => {
    process.stdout.write(`${result.detail}\n`);
    process.exit(result.healthy ? 0 : 1);
  });
}
