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
});
