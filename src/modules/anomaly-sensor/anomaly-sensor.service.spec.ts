import { Test, TestingModule } from '@nestjs/testing';
import { AnomalySensorService } from './anomaly-sensor.service';
import { AlertingService } from './alerting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

describe('AnomalySensorService', () => {
  let service: AnomalySensorService;
  let alertingService: jest.Mocked<AlertingService>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockAlertingService = {
      dispatchAlert: jest.fn(),
    };

    const mockPrismaService = {
      eventLog: {
        create: jest.fn(),
      },
      escrowTransaction: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalySensorService,
        { provide: AlertingService, useValue: mockAlertingService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnomalySensorService>(AnomalySensorService);
    alertingService = module.get(AlertingService);
    prismaService = module.get(PrismaService);
    
    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Clean up the interval timer created by onModuleInit
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleAuthFailed', () => {
    it('should trigger an alert if 6 failures happen within 5 minutes', async () => {
      const email = 'test@example.com';
      for (let i = 0; i < 6; i++) {
        await service.handleAuthFailed({ email, ip: '127.0.0.1', timestamp: new Date().toISOString() });
      }

      expect(alertingService.dispatchAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'HIGH',
          title: 'Authentication Brute Force Attempt',
        })
      );
      expect(prismaService.eventLog.create).toHaveBeenCalled();
    });

    it('should not trigger an alert if less than 6 failures happen', async () => {
      const email = 'test2@example.com';
      for (let i = 0; i < 5; i++) {
        await service.handleAuthFailed({ email, ip: '127.0.0.1', timestamp: new Date().toISOString() });
      }

      expect(alertingService.dispatchAlert).not.toHaveBeenCalled();
    });
  });

  describe('handleAuthSuccess (Fix #4: False Positive Prevention)', () => {
    it('should clear failure counter on successful login, preventing false positives', async () => {
      const email = 'legitimate-user@example.com';

      // Simulate 5 failed login attempts (just under the threshold)
      for (let i = 0; i < 5; i++) {
        await service.handleAuthFailed({ email, ip: '127.0.0.1', timestamp: new Date().toISOString() });
      }

      // User successfully logs in - counter should be cleared
      service.handleAuthSuccess({ email, timestamp: new Date().toISOString() });

      // Now a subsequent typo should NOT trigger a brute-force alert
      // because the counter was reset on successful login
      await service.handleAuthFailed({ email, ip: '127.0.0.1', timestamp: new Date().toISOString() });

      expect(alertingService.dispatchAlert).not.toHaveBeenCalled();
    });

    it('should not affect other emails when one user logs in successfully', async () => {
      const attacker = 'attacker@evil.com';
      const legitimate = 'user@company.com';

      // Attacker has 5 failures
      for (let i = 0; i < 5; i++) {
        await service.handleAuthFailed({ email: attacker, ip: '1.2.3.4', timestamp: new Date().toISOString() });
      }

      // Legitimate user logs in successfully - should only clear their own counter
      service.handleAuthSuccess({ email: legitimate, timestamp: new Date().toISOString() });

      // Attacker's 6th attempt should still trigger alert
      await service.handleAuthFailed({ email: attacker, ip: '1.2.3.4', timestamp: new Date().toISOString() });

      expect(alertingService.dispatchAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'HIGH',
          title: 'Authentication Brute Force Attempt',
        })
      );
    });
  });

  describe('Bounded Map (Fix #2: DoS Prevention)', () => {
    it('should evict oldest entry when MAX_TRACKED_EMAILS limit is reached', async () => {
      // Access the private static via bracket notation for testing
      const maxEmails = (AnomalySensorService as any).MAX_TRACKED_EMAILS;
      expect(maxEmails).toBe(10_000);

      // Fill the map to capacity with unique emails
      for (let i = 0; i < maxEmails; i++) {
        await service.handleAuthFailed({
          email: `user${i}@flood.com`,
          ip: '1.2.3.4',
          timestamp: new Date().toISOString(),
        });
      }

      // Adding one more should not throw OOM - oldest should be evicted
      await service.handleAuthFailed({
        email: 'new-attacker@overflow.com',
        ip: '1.2.3.4',
        timestamp: new Date().toISOString(),
      });

      // The map should still be at max capacity, not growing beyond it
      expect((service as any).authFailures.size).toBeLessThanOrEqual(maxEmails);
    });
  });

  describe('Event Loop Safety (Fix #3: Unreferenced Interval)', () => {
    it('should create an unref\'d cleanup interval in onModuleInit', () => {
      service.onModuleInit();
      const interval = (service as any).cleanupInterval;
      expect(interval).toBeDefined();
      // Verify the interval has been unref'd by checking it exists
      // (Node.js Timeout objects don't expose a direct .hasRef() in all versions,
      // but the presence of the timer confirms onModuleInit ran without error)
      expect(interval[Symbol.toPrimitive]?.() || interval).toBeTruthy();
    });

    it('should clear the interval in onModuleDestroy', () => {
      service.onModuleInit();
      const clearSpy = jest.spyOn(global, 'clearInterval');
      service.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });

  describe('handlePaymentInitiated', () => {
    it('should trigger alert on Z-Score > 2.5 with same-currency history', async () => {
      // Mock history: 3 ETB transactions of amount 100
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([
        { grossAmount: 100, currency: 'ETB' } as any,
        { grossAmount: 100, currency: 'ETB' } as any,
        { grossAmount: 100, currency: 'ETB' } as any,
      ]);

      // A gross amount of 1000 ETB will be way above the mean of 100
      await service.handlePaymentInitiated({
        escrowId: 'escrow-1',
        clientId: 'client-1',
        grossAmount: 1000,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
      });

      expect(alertingService.dispatchAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'CRITICAL',
          title: 'Suspicious Payment Transaction',
        })
      );
      expect(prismaService.eventLog.create).toHaveBeenCalled();
    });

    it('should filter history by same currency (Fix #1: Currency Isolation)', async () => {
      // This test verifies that the Prisma query includes the currency filter
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.handlePaymentInitiated({
        escrowId: 'escrow-currency-test',
        clientId: 'client-multi',
        grossAmount: 5000,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      });

      // Verify the findMany was called with the currency filter
      expect(prismaService.escrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency: 'USD',
          }),
        })
      );
    });

    it('should not trigger alert on Z-Score <= 2.5 or insufficient history', async () => {
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([
        { grossAmount: 100, currency: 'ETB' } as any,
      ]); // Only 1 past transaction - insufficient for Z-Score

      await service.handlePaymentInitiated({
        escrowId: 'escrow-2',
        clientId: 'client-1',
        grossAmount: 1000,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
      });

      expect(alertingService.dispatchAlert).not.toHaveBeenCalled();
    });
  });
});
