import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

const mockI18n = {
  t: jest.fn().mockResolvedValue('Service temporarily unavailable.'),
};

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService(mockI18n as never);
  });

  afterEach(() => jest.clearAllMocks());

  describe('CLOSED state', () => {
    it('passes through a successful action', async () => {
      const result = await service.execute('test', async () => 42);
      expect(result).toBe(42);
    });

    it('stays CLOSED after a single failure below threshold', async () => {
      await expect(
        service.execute('test', async () => { throw new Error('boom'); }),
      ).rejects.toThrow('boom');
      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN state', () => {
    it('opens after reaching the failure threshold', async () => {
      const failingAction = async () => { throw new Error('fail'); };

      for (let i = 0; i < 3; i++) {
        await service.execute('svc', failingAction).catch(() => {});
      }

      expect(service.getState('svc')).toBe(CircuitState.OPEN);
    });

    it('fast-fails with ServiceUnavailableException when OPEN', async () => {
      const failingAction = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        await service.execute('svc2', failingAction).catch(() => {});
      }

      await expect(
        service.execute('svc2', async () => 'ok'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('HALF_OPEN state', () => {
    it('transitions to CLOSED after enough successes', async () => {
      const failingAction = async () => { throw new Error('fail'); };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await service.execute('svc3', failingAction, { failureThreshold: 3, timeout: 0, successThreshold: 2 }).catch(() => {});
      }

      // timeout=0 means it's immediately HALF_OPEN eligible
      await service.execute('svc3', async () => 'ok', { failureThreshold: 3, timeout: 0, successThreshold: 2 });
      await service.execute('svc3', async () => 'ok', { failureThreshold: 3, timeout: 0, successThreshold: 2 });

      expect(service.getState('svc3')).toBe(CircuitState.CLOSED);
    });

    it('allows only one concurrent probe while HALF_OPEN (no thundering herd)', async () => {
      const failingAction = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        await service
          .execute('herd', failingAction, { failureThreshold: 3, timeout: 0, successThreshold: 1 })
          .catch(() => {});
      }
      expect(service.getState('herd')).toBe(CircuitState.OPEN);

      let releaseProbe!: () => void;
      const probeGate = new Promise<void>((resolve) => {
        releaseProbe = resolve;
      });

      const probe = service.execute(
        'herd',
        async () => {
          await probeGate;
          return 'probe-ok';
        },
        { failureThreshold: 3, timeout: 0, successThreshold: 1 },
      );

      // Give the probe time to claim HALF_OPEN before concurrent callers
      await new Promise((r) => setImmediate(r));
      expect(service.getState('herd')).toBe(CircuitState.HALF_OPEN);

      const rejected = await Promise.allSettled([
        service.execute('herd', async () => 'should-not-run', {
          failureThreshold: 3,
          timeout: 0,
          successThreshold: 1,
        }),
        service.execute('herd', async () => 'should-not-run-2', {
          failureThreshold: 3,
          timeout: 0,
          successThreshold: 1,
        }),
      ]);

      expect(rejected.every((r) => r.status === 'rejected')).toBe(true);
      expect(
        rejected.every(
          (r) =>
            r.status === 'rejected' &&
            r.reason instanceof ServiceUnavailableException,
        ),
      ).toBe(true);

      releaseProbe();
      await expect(probe).resolves.toBe('probe-ok');
      expect(service.getState('herd')).toBe(CircuitState.CLOSED);
    });
  });

  describe('reset()', () => {
    it('resets an OPEN circuit back to CLOSED', async () => {
      const failingAction = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        await service.execute('svc4', failingAction).catch(() => {});
      }
      expect(service.getState('svc4')).toBe(CircuitState.OPEN);

      service.reset('svc4');
      expect(service.getState('svc4')).toBe(CircuitState.CLOSED);
    });
  });

  describe('executionTimeout', () => {
    it('fails hung actions even when cooldown timeout is large', async () => {
      await expect(
        service.execute(
          'slow',
          // Never resolves — must not leave timers that keep Jest alive
          () => new Promise(() => undefined),
          { failureThreshold: 5, timeout: 60_000, executionTimeout: 50 },
        ),
      ).rejects.toThrow(/execution timeout/i);
    });

    it('does not treat cooldown timeout as an action deadline', async () => {
      const result = await service.execute(
        'fast',
        async () => 'ok',
        { failureThreshold: 3, timeout: 1, executionTimeout: 5_000 },
      );
      expect(result).toBe('ok');
    });
  });
});
