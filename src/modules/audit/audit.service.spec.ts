import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrismaService = {
  eventLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should write an event with the given eventType, entityId, and entityType', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.log('USER_LOGIN', 'user-1', { ip: '1.2.3.4' }, 'User');

      expect(mockPrismaService.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'USER_LOGIN',
          entityId: 'user-1',
          entityType: 'User',
        }),
      });
    });

    it('should default entityType to "User" when not provided', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.log('SOME_EVENT', 'user-1', {});

      expect(mockPrismaService.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'User' }),
      });
    });

    it('should redact known-sensitive keys from the payload before persisting', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.log('USER_LOGIN', 'user-1', {
        password: 'super-secret',
        note: 'ok',
      });

      const persisted = mockPrismaService.eventLog.create.mock.calls[0][0].data.payload;
      expect(persisted.password).toBe('[REDACTED]');
      expect(persisted.note).toBe('ok');
    });

    it('should mask PII (e.g. emails) found inside free-text payload values', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.log('DISPUTE_CREATED', 'dispute-1', {
        reason: 'Contact me at johndoe@example.com',
      });

      const persisted = mockPrismaService.eventLog.create.mock.calls[0][0].data.payload;
      expect(persisted.reason).not.toContain('johndoe@example.com');
    });
  });

  describe('logPaymentTransaction', () => {
    it('should always persist amount and currency together', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.logPaymentTransaction('txn-1', 'ESCROW_RELEASED', 1500, 'ETB');

      expect(mockPrismaService.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'ESCROW_RELEASED',
          entityId: 'txn-1',
          entityType: 'Payment',
          payload: expect.objectContaining({ amount: 1500, currency: 'ETB' }),
        }),
      });
    });
  });

  describe('logAuthEvent', () => {
    it('should record a login event against the given userId', async () => {
      mockPrismaService.eventLog.create.mockResolvedValue({});

      await service.logAuthEvent('user-1', 'USER_LOGIN');

      expect(mockPrismaService.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'USER_LOGIN',
          entityId: 'user-1',
          entityType: 'User',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return a paginated result with default page/limit', async () => {
      mockPrismaService.eventLog.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrismaService.eventLog.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [{ id: '1' }],
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });

    it('should cap limit at 100 even if a larger value is requested', async () => {
      mockPrismaService.eventLog.findMany.mockResolvedValue([]);
      mockPrismaService.eventLog.count.mockResolvedValue(0);

      await service.findAll({ limit: 500 });

      expect(mockPrismaService.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter by entityType and entityId when provided', async () => {
      mockPrismaService.eventLog.findMany.mockResolvedValue([]);
      mockPrismaService.eventLog.count.mockResolvedValue(0);

      await service.findAll({ entityType: 'Payment', entityId: 'txn-1' });

      expect(mockPrismaService.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'Payment', entityId: 'txn-1' }),
        }),
      );
    });

    it('should apply a createdAt range filter when dateFrom/dateTo are provided', async () => {
      mockPrismaService.eventLog.findMany.mockResolvedValue([]);
      mockPrismaService.eventLog.count.mockResolvedValue(0);

      await service.findAll({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });

      const where = mockPrismaService.eventLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(where.createdAt.lte).toEqual(new Date('2026-01-31'));
    });
  });
});
