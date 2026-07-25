import { NotFoundException } from '@nestjs/common';
import { AuditLoggingService } from './audit-logging.service';

describe('AuditLoggingService', () => {
  const prisma = {
    eventLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const i18n = {
    t: jest.fn((_key: string, opts: { defaultValue: string }) => opts.defaultValue),
  };

  const walletService = {
    convertCurrency: jest.fn((amount: number) => amount * 2),
  };

  let service: AuditLoggingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLoggingService(
      prisma as never,
      i18n as never,
      walletService as never,
    );
  });

  describe('create', () => {
    it('persists a redacted payload', async () => {
      const createdAt = new Date('2026-07-26T00:00:00.000Z');
      prisma.eventLog.create.mockResolvedValue({
        id: 'log-1',
        eventType: 'HTTP_REQUEST',
        entityId: 'user-1',
        entityType: 'HttpRequest',
        payload: { password: '[REDACTED]', path: '/api/v1/jobs' },
        processedBy: 'AuditInterceptor',
        actorUserId: 'user-1',
        ipAddress: '10.0.0.1',
        httpMethod: 'GET',
        path: '/api/v1/jobs',
        statusCode: 200,
        durationMs: 12,
        createdAt,
      });

      const result = await service.create({
        eventType: 'HTTP_REQUEST',
        entityId: 'user-1',
        entityType: 'HttpRequest',
        payload: { password: 'plain', path: '/api/v1/jobs' },
        processedBy: 'AuditInterceptor',
        actorUserId: 'user-1',
        httpMethod: 'GET',
        path: '/api/v1/jobs',
        statusCode: 200,
        durationMs: 12,
      });

      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'HTTP_REQUEST',
            payload: expect.objectContaining({ password: '[REDACTED]' }),
          }),
        }),
      );
      expect(result.id).toBe('log-1');
    });
  });

  describe('buildWhere', () => {
    it('combines filters and search into AND clauses', () => {
      const where = service.buildWhere({
        eventType: 'HTTP_REQUEST',
        httpMethod: 'get',
        statusCode: 401,
        search: 'jobs',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.000Z',
      });

      expect(where).toEqual(
        expect.objectContaining({
          AND: expect.arrayContaining([
            { eventType: 'HTTP_REQUEST' },
            { httpMethod: 'GET' },
            { statusCode: 401 },
          ]),
        }),
      );
    });
  });

  describe('findMany', () => {
    it('returns paginated results with currency metadata', async () => {
      prisma.eventLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          eventType: 'PAYMENT',
          entityId: 'tx-1',
          entityType: 'Payment',
          payload: { amount: 50, currency: 'ETB' },
          processedBy: null,
          actorUserId: null,
          ipAddress: null,
          httpMethod: null,
          path: null,
          statusCode: null,
          durationMs: null,
          createdAt: new Date(),
        },
      ]);
      prisma.eventLog.count.mockResolvedValue(1);

      const result = await service.findMany({ page: 1, limit: 10, currency: 'USD', lang: 'en' });

      expect(result.meta.total).toBe(1);
      expect(result.currency).toBe('USD');
      expect(result.data[0].amountInDisplayCurrency).toBe(100);
      expect(walletService.convertCurrency).toHaveBeenCalledWith(50, 'ETB', 'USD');
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when missing', async () => {
      prisma.eventLog.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('export', () => {
    it('exports CSV when format=csv', async () => {
      prisma.eventLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          eventType: 'HTTP_REQUEST',
          entityId: 'user-1',
          entityType: 'HttpRequest',
          payload: {},
          processedBy: null,
          actorUserId: 'user-1',
          ipAddress: null,
          httpMethod: 'GET',
          path: '/x',
          statusCode: 200,
          durationMs: 5,
          createdAt: new Date('2026-07-26T00:00:00.000Z'),
        },
      ]);

      const result = await service.export({ format: 'csv' });
      expect(result.contentType).toContain('text/csv');
      expect(result.body.split('\n')[0]).toContain('eventType');
      expect(result.body).toContain('HTTP_REQUEST');
    });
  });
});
