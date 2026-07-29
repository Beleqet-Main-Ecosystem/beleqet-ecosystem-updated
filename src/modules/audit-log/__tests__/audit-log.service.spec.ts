import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    eventLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLog', () => {
    it('should scrub PII sensitive fields before calling prisma.auditLog.create', async () => {
      const inputDto = {
        userId: 'usr-123',
        action: 'USER_REGISTER',
        entity: 'USER',
        previousState: { password: 'SuperSecretPassword123!', email: 'john.doe@example.com' },
        newState: { id: 'usr-123', email: 'john.doe@example.com', phone: '+1234567890' },
      };

      mockPrismaService.eventLog.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'log-1', ...data }),
      );

      const result = await service.createLog(inputDto);

      expect(prismaService.eventLog.create).toHaveBeenCalledTimes(1);
      const callArg = (prismaService.eventLog.create as jest.Mock).mock.calls[0][0].data;

      // Sensitive password must be redacted
      expect(callArg.payload.previousState.password).toBe('[REDACTED]');
      // Emails & phones must be masked according to GDPR rules
      expect(callArg.payload.previousState.email).toContain('***');
      expect(callArg.payload.newState.phone).toContain('***');
      expect(result.id).toBe('log-1');
    });

    it('should enforce multi-currency compliance on financial payloads', async () => {
      const financialDto = {
        userId: 'usr-123',
        action: 'CREATE_JOB',
        entity: 'JOB',
        newState: { title: 'Developer', salaryMin: 50000, salaryMax: 90000, currency: 'ETB' },
      };

      mockPrismaService.eventLog.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'log-2', ...data }),
      );

      await service.createLog(financialDto);

      const callArg = (prismaService.eventLog.create as jest.Mock).mock.calls[0][0].data;
      expect(callArg.payload.newState.currency).toBe('ETB');
      expect(callArg.payload.newState._currencyComplianceWarning).toBeUndefined();
    });

    it('should tag a warning when a financial payload lacks a valid ISO currency code', async () => {
      const invalidFinancialDto = {
        userId: 'usr-123',
        action: 'CREATE_JOB',
        entity: 'JOB',
        newState: { title: 'Developer', salaryMin: 50000, salaryMax: 90000 },
      };

      mockPrismaService.eventLog.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'log-3', ...data }),
      );

      await service.createLog(invalidFinancialDto);

      const callArg = (prismaService.eventLog.create as jest.Mock).mock.calls[0][0].data;
      expect(callArg.payload.newState._currencyComplianceWarning).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
      mockPrismaService.eventLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.eventLog.count.mockResolvedValue(2);

      const response = await service.findAll({ page: 1, limit: 10 });

      expect(response.data).toHaveLength(2);
      expect(response.total).toBe(2);
      expect(response.totalPages).toBe(1);
    });
  });

  describe('searchLogs', () => {
    it('should filter logs by userId and action', async () => {
      mockPrismaService.eventLog.findMany.mockResolvedValue([
        { id: 'log-1', processedBy: 'usr-123' },
      ]);
      mockPrismaService.eventLog.count.mockResolvedValue(1);

      const response = await service.searchLogs({ userId: 'usr-123', action: 'CREATE' });

      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            processedBy: 'usr-123',
            eventType: expect.objectContaining({ contains: 'CREATE' }),
          }),
        }),
      );
      expect(response.data).toHaveLength(1);
    });
  });

  describe('purgeExpiredLogs', () => {
    it('should purge logs older than the retention window for GDPR compliance', async () => {
      mockPrismaService.eventLog.deleteMany.mockResolvedValue({ count: 15 });

      const result = await service.purgeExpiredLogs(30);

      expect(prismaService.eventLog.deleteMany).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(15);
      expect(result.retentionDays).toBe(30);
    });
  });
});
