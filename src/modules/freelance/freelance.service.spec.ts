import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { FreelanceService } from './freelance.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: Record<string, any> = {
  freelanceJob: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  bid: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  contract: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  milestone: { create: jest.fn(), findFirst: jest.fn() },
  escrowTransaction: { findFirst: jest.fn() },
  employerWallet: { upsert: jest.fn() },
  employerWalletTransaction: { create: jest.fn() },
  chatRoom: { create: jest.fn() },
  chatParticipant: { create: jest.fn() },
  $transaction: jest.fn((cb: (tx: any) => any) => cb(mockPrisma)),
};

describe('FreelanceService', () => {
  let svc: FreelanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FreelanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    svc = module.get<FreelanceService>(FreelanceService);
  });

  describe('createJob', () => {
    it('should create a freelance job', async () => {
      mockPrisma.freelanceJob.create.mockResolvedValue({ id: 'g1', title: 'Build Website' });
      const result = await svc.createJob('client-1', {
        title: 'Build Website', description: 'desc', categoryId: 'c1',
        budgetMin: 1000, budgetMax: 5000, deadlineDays: 30, skills: ['React'],
      } as any);
      expect(result.id).toBe('g1');
    });
  });

  describe('findJobs', () => {
    it('should return paginated results', async () => {
      mockPrisma.freelanceJob.findMany.mockResolvedValue([]);
      mockPrisma.freelanceJob.count.mockResolvedValue(0);
      const result = await svc.findJobs({});
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findJobById', () => {
    it('should return a job', async () => {
      mockPrisma.freelanceJob.findUnique.mockResolvedValue({ id: 'g1' });
      const result = await svc.findJobById('g1');
      expect(result.id).toBe('g1');
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.freelanceJob.findUnique.mockResolvedValue(null);
      await expect(svc.findJobById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitBid', () => {
    it('should throw NotFoundException if gig not found', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue(null);
      await expect(svc.submitBid('f1', 'g1', { amount: 1000, timelineDays: 10, coverLetter: 'hi' } as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate bid', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue({ id: 'g1' });
      mockPrisma.bid.findUnique.mockResolvedValue({ id: 'b1' });
      await expect(svc.submitBid('f1', 'g1', { amount: 1000, timelineDays: 10, coverLetter: 'hi' } as any))
        .rejects.toThrow(ConflictException);
    });

    it('should create a bid', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue({ id: 'g1' });
      mockPrisma.bid.findUnique.mockResolvedValue(null);
      mockPrisma.bid.create.mockResolvedValue({ id: 'b1', amount: 1000 });
      const result = await svc.submitBid('f1', 'g1', { amount: 1000, timelineDays: 10, coverLetter: 'hi' } as any);
      expect(result.id).toBe('b1');
    });
  });

  describe('acceptBid', () => {
    it('should throw NotFoundException if bid not found', async () => {
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      await expect(svc.acceptBid('b1', 'client-1')).rejects.toThrow(NotFoundException);
    });

    it('should accept bid and create contract', async () => {
      mockPrisma.bid.findFirst.mockResolvedValue({ id: 'b1', freelanceJobId: 'g1', freelancerId: 'f1', amount: 1000 });
      mockPrisma.escrowTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.contract.create.mockResolvedValue({ id: 'c1' });

      const result = await svc.acceptBid('b1', 'client-1');
      expect(result.id).toBe('c1');
      expect(mockPrisma.bid.update).toHaveBeenCalled();
      expect(mockPrisma.bid.updateMany).toHaveBeenCalled();
    });
  });

  describe('rejectBid', () => {
    it('should throw NotFoundException if bid not found', async () => {
      mockPrisma.bid.findFirst.mockResolvedValue(null);
      await expect(svc.rejectBid('b1', 'client-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject a bid', async () => {
      mockPrisma.bid.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.bid.update.mockResolvedValue({ id: 'b1', status: 'REJECTED' });
      const result = await svc.rejectBid('b1', 'client-1');
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('getMyBids', () => {
    it('should return freelancer bids', async () => {
      mockPrisma.bid.findMany.mockResolvedValue([{ id: 'b1' }]);
      const result = await svc.getMyBids('f1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getMyContracts', () => {
    it('should return contracts for a user', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([{ id: 'c1' }]);
      const result = await svc.getMyContracts('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getContract', () => {
    it('should return a contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'c1' });
      const result = await svc.getContract('c1');
      expect(result.id).toBe('c1');
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);
      await expect(svc.getContract('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createMilestone', () => {
    it('should throw ForbiddenException if not authorized', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      await expect(svc.createMilestone('f1', 'c1', { title: 'Phase 1', amount: 500, deadline: '2026-12-01T00:00:00.000Z' } as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('should create a milestone', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({ id: 'c1', freelancerId: 'f1' });
      mockPrisma.milestone.create.mockResolvedValue({ id: 'm1', title: 'Phase 1' });
      const result = await svc.createMilestone('f1', 'c1', { title: 'Phase 1', amount: 500, deadline: '2026-12-01T00:00:00.000Z' } as any);
      expect(result.id).toBe('m1');
    });
  });
});
