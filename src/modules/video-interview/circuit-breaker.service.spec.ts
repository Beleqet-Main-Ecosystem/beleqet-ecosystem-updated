import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

const mockI18n = {
  t: jest.fn().mockResolvedValue('Service temporarily unavailable.'),
};

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: 'I18nService', useValue: mockI18n },
      ],
    })
      .overrideProvider('I18nService')
      .useValue(mockI18n)
      .compile();

    // Manually instantiate since I18nService injection name differs
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
});
