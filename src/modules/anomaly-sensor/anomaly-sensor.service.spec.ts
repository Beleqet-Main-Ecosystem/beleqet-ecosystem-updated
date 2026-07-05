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
});
