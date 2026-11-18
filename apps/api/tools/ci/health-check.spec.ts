import { runHealthCheck } from './health-check';
import type { FetchLike, MinimalResponse } from './health-check';
import type { HealthCheckOptions } from './types';

/** Sleep stub that records requested delays without waiting. */
function instantSleep(): { sleep: (ms: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    },
  };
}

function options(overrides: Partial<HealthCheckOptions> = {}): HealthCheckOptions {
  return {
    url: 'http://localhost:4000/api/v1/health/ready',
    maxAttempts: 3,
    timeoutMs: 1000,
    retryDelayMs: 50,
    ...overrides,
  };
}

function respondingWith(...statuses: number[]): { fetch: FetchLike; calls: () => number } {
  let call = 0;
  const fetch: FetchLike = () => {
    const status = statuses[Math.min(call, statuses.length - 1)];
    call += 1;
    return Promise.resolve<MinimalResponse>({ status });
  };
  return { fetch, calls: () => call };
}

describe('runHealthCheck', () => {
  it('succeeds on an HTTP 2xx response', async () => {
    const { fetch } = respondingWith(200);
    const result = await runHealthCheck(options(), fetch, instantSleep().sleep);
    expect(result.healthy).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.lastStatus).toBe(200);
  });

  it('treats any 2xx status as healthy', async () => {
    const { fetch } = respondingWith(204);
    const result = await runHealthCheck(options(), fetch, instantSleep().sleep);
    expect(result.healthy).toBe(true);
  });

  it('retries transient failures until a healthy response', async () => {
    let call = 0;
    const flaky: FetchLike = () => {
      call += 1;
      if (call < 3) {
        return Promise.reject(new Error('ECONNREFUSED'));
      }
      return Promise.resolve<MinimalResponse>({ status: 200 });
    };
    const { sleep, delays } = instantSleep();
    const result = await runHealthCheck(options({ maxAttempts: 5 }), flaky, sleep);
    expect(result.healthy).toBe(true);
    expect(result.attempts).toBe(3);
    expect(delays).toEqual([50, 50]);
  });

  it('stops after the configured maximum attempts', async () => {
    const { fetch, calls } = respondingWith(503);
    const result = await runHealthCheck(options({ maxAttempts: 4 }), fetch, instantSleep().sleep);
    expect(result.healthy).toBe(false);
    expect(result.attempts).toBe(4);
    expect(calls()).toBe(4);
    expect(result.lastStatus).toBe(503);
  });

  it('applies the expected per-attempt timeout via AbortSignal', async () => {
    jest.useFakeTimers();
    try {
      const hanging: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      const { sleep } = instantSleep();
      const pending = runHealthCheck(options({ maxAttempts: 1, timeoutMs: 700 }), hanging, sleep);
      await jest.advanceTimersByTimeAsync(699);
      await jest.advanceTimersByTimeAsync(1);
      const result = await pending;
      expect(result.healthy).toBe(false);
      expect(result.detail).toContain('timeout');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry unrecoverable configuration errors', async () => {
    const { fetch, calls } = respondingWith(200);
    const badUrl = await runHealthCheck(options({ url: 'not a url' }), fetch);
    expect(badUrl.healthy).toBe(false);
    expect(badUrl.attempts).toBe(0);
    expect(badUrl.detail).toContain('Configuration error');

    const badAttempts = await runHealthCheck(options({ maxAttempts: 0 }), fetch);
    expect(badAttempts.healthy).toBe(false);
    expect(badAttempts.attempts).toBe(0);

    const badTimeout = await runHealthCheck(options({ timeoutMs: -5 }), fetch);
    expect(badTimeout.healthy).toBe(false);
    expect(badTimeout.attempts).toBe(0);

    expect(calls()).toBe(0); // no network activity for any configuration error
  });

  it('returns actionable sanitized errors (no URL credentials, no bodies)', async () => {
    const failing: FetchLike = () => Promise.reject(new Error('secret-token-abc leaked'));
    const result = await runHealthCheck(
      options({ url: 'http://user:pass@host.test/health', maxAttempts: 2 }),
      failing,
      instantSleep().sleep,
    );
    expect(result.healthy).toBe(false);
    expect(result.detail).not.toContain('secret-token-abc');
    expect(result.detail).not.toContain('user:pass');
    expect(result.detail).toContain('2 attempts');
  });
});
