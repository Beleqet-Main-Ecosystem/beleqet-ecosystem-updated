import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';

describe('AuditService', () => {
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

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as never, i18n as never, walletService as never);
  });

  describe('log', () => {
    it('should write an event with the given eventType, entityId, and entityType', async () => {
      prisma.eventLog.create.mockResolvedValue({});

      await service.log('USER_LOGIN', 'user-1', { ip: '1.2.3.4' }, 'User');

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'USER_LOGIN',
          entityId: 'user-1',
          entityType: 'User',
        }),
      });
    });

    it('should default entityType to "User" when not provided', async () => {
      prisma.eventLog.create.mockResolvedValue({});

      await service.log('SOME_EVENT', 'user-1', {});

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'User' }),
      });
    });

    it('should redact known-sensitive keys from the payload before persisting', async () => {
      prisma.eventLog.create.mockResolvedValue({});

      await service.log('USER_LOGIN', 'user-1', {
        password: 'super-secret',
        note: 'ok',
      });

      const persisted = prisma.eventLog.create.mock.calls[0][0].data.payload;
      expect(persisted.password).toBe('[REDACTED]');
      expect(persisted.note).toBe('ok');
    });

    it('should mask PII (e.g. emails) found inside free-text payload values', async () => {
      prisma.eventLog.create.mockResolvedValue({});

      await service.log('DISPUTE_CREATED', 'dispute-1', {
        reason: 'Contact me at johndoe@example.com',
      });

      const persisted = prisma.eventLog.create.mock.calls[0][0].data.payload;
      expect(persisted.reason).not.toContain('johndoe@example.com');
    });
  });

  describe('logPaymentTransaction', () => {
    it('should always persist amount and currency together', async () => {
      prisma.eventLog.create.mockResolvedValue({});

      await service.logPaymentTransaction('txn-1', 'ESCROW_RELEASED', 1500, 'ETB');

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
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
      prisma.eventLog.create.mockResolvedValue({});

      await service.logAuthEvent('user-1', 'USER_LOGIN');

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'USER_LOGIN',
          entityId: 'user-1',
          entityType: 'User',
        }),
      });
    });
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
