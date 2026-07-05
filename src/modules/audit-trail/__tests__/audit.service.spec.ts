import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { QUEUE_NAMES } from '../../queues/queues.constants';
import { AuditAction } from '../audit-action.enum';
import { computeIntegrityHash } from '../utils/integrity-hash.util';

const mockQueue = { add: jest.fn() };

const mockPrisma = {
  auditLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getQueueToken(QUEUE_NAMES.AUDIT_TRAIL), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log()', () => {
    it('enqueues a write job successfully', async () => {
      mockQueue.add.mockResolvedValueOnce({});
      await expect(
        service.log({ action: AuditAction.AUTH_LOGIN, entityType: 'User' }),
      ).resolves.toBeUndefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'write',
        expect.objectContaining({ action: AuditAction.AUTH_LOGIN }),
      );
    });

    it('never throws when the queue fails — failure isolation (Property 4)', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Redis down'));
      await expect(
        service.log({ action: AuditAction.AUTH_LOGIN, entityType: 'User' }),
      ).resolves.toBeUndefined();
    });

    it('truncates metadata exceeding 64 KB', async () => {
      mockQueue.add.mockResolvedValueOnce({});
      const bigValue = 'x'.repeat(70 * 1024);
      await service.log({
        action: AuditAction.AUTH_LOGIN,
        entityType: 'User',
        metadata: { big: bigValue },
      });
      const calledWith = mockQueue.add.mock.calls[0][1];
      expect(calledWith.metadata).toEqual({ _truncated: true });
    });
  });

  describe('maskEmail()', () => {
    it('masks a normal email — Property 9', () => {
      expect(service.maskEmail('john@example.com')).toBe('joh***@example.com');
    });

    it('masks a short local part', () => {
      expect(service.maskEmail('ab@example.com')).toBe('ab***@example.com');
    });

    it('output always matches the structural pattern', () => {
      const emails = ['alice@domain.com', 'bo@test.io', 'charlie.doe@company.org'];
      for (const email of emails) {
        expect(service.maskEmail(email)).toMatch(/^.{2,3}\*\*\*@.+$/);
      }
    });
  });

  describe('verifyIntegrity()', () => {
    it('returns true when hash matches — Property 2', async () => {
      const id = 'log-1';
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      const record = {
        id,
        actorId: 'actor-1',
        action: 'AUTH_LOGIN',
        entityType: 'User',
        entityId: 'user-1',
        createdAt,
        ipAddress: '1.2.3.4',
        metadata: {},
        integrityHash: computeIntegrityHash({
          id,
          actorId: 'actor-1',
          action: 'AUTH_LOGIN',
          entityType: 'User',
          entityId: 'user-1',
          createdAt,
          ipAddress: '1.2.3.4',
          metadata: {},
        }),
      };
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(record);
      await expect(service.verifyIntegrity(id)).resolves.toBe(true);
    });

    it('returns false when hash does not match', async () => {
      const record = {
        id: 'log-2',
        actorId: null,
        action: 'AUTH_LOGOUT',
        entityType: 'User',
        entityId: null,
        createdAt: new Date(),
        ipAddress: null,
        metadata: {},
        integrityHash: 'tampered-hash',
      };
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(record);
      await expect(service.verifyIntegrity('log-2')).resolves.toBe(false);
    });

    it('returns false for a non-existent record', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(null);
      await expect(service.verifyIntegrity('missing')).resolves.toBe(false);
    });
  });

  describe('findOne()', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ghost-id')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('query()', () => {
    it('returns pagination metadata with correct totalPages', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[{ id: '1' }, { id: '2' }], 45]);
      const result = await service.query({ page: 2, limit: 20 });
      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });
  });
});
