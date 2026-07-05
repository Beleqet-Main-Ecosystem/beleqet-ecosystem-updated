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

  describe('handlePaymentInitiated', () => {
    it('should trigger alert on Z-Score > 2.5', async () => {
      // Mock history: 3 transactions of amount 100
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([
        { grossAmount: 100 } as any,
        { grossAmount: 100 } as any,
        { grossAmount: 100 } as any,
      ]);

      // A gross amount of 1000 will be way above the mean of 100 with 0 stddev
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

    it('should not trigger alert on Z-Score <= 2.5 or insufficient history', async () => {
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([
        { grossAmount: 100 } as any,
      ]); // Only 1 past transaction

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
