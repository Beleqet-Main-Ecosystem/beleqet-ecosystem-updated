import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  userTwoFactor: {
    findUnique: jest.fn(),
  },
  job: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

describe('UsersService', () => {
  let svc: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    svc = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('should return a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@t.com' });
      const result = await svc.findById('u1');
      expect(result.id).toBe('u1');
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', firstName: 'Jane' });
      const result = await svc.update('u1', { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('addClientFeedback', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.addClientFeedback('u1', { rating: 5 })).rejects.toThrow(NotFoundException);
    });

    it('should append feedback to existing array', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', clientFeedback: [{ rating: 4 }] });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', clientFeedback: [{ rating: 4 }, { rating: 5 }] });

      const result = await svc.addClientFeedback('u1', { rating: 5 });
      expect(result.clientFeedback).toHaveLength(2);
    });

    it('should handle null clientFeedback', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', clientFeedback: null });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', clientFeedback: [{ rating: 5 }] });

      const result = await svc.addClientFeedback('u1', { rating: 5 });
      expect(result.clientFeedback).toHaveLength(1);
    });
  });

  describe('verifySkill', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.verifySkill('u1', true)).rejects.toThrow(NotFoundException);
    });

    it('should update skill verification status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', skillVerified: true });

      const result = await svc.verifySkill('u1', true);
      expect(result.skillVerified).toBe(true);
    });
  });

  describe('createCompany', () => {
    it('should create a company', async () => {
      mockPrisma.company.create.mockResolvedValue({ id: 'c1', name: 'Acme' });
      const result = await svc.createCompany('u1', { name: 'Acme' } as any);
      expect(result.name).toBe('Acme');
    });
  });

  describe('getCompany', () => {
    it('should return a company', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'c1', jobs: [] });
      const result = await svc.getCompany('u1');
      expect(result!.id).toBe('c1');
    });
  });

  describe('getNotifications', () => {
    it('should return notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      const result = await svc.getNotifications('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('markNotificationRead', () => {
    it('should mark a notification as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      const result = await svc.markNotificationRead('n1', 'u1');
      expect(result.count).toBe(1);
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await svc.markAllNotificationsRead('u1');
      expect(result.count).toBe(5);
    });
  });

  describe('saveJob', () => {
    it('should save a job', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      const result = await svc.saveJob('u1', 'j1');
      expect(result.userId).toBe('u1');
      expect(result.jobId).toBe('j1');
    });
  });

  describe('removeSavedJob', () => {
    it('should remove a saved job', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1);
      const result = await svc.removeSavedJob('u1', 'j1');
      expect(result.count).toBe(1);
    });
  });

  describe('getCvDraft', () => {
    it('should return null if no draft', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const result = await svc.getCvDraft('u1');
      expect(result).toBeNull();
    });

    it('should return a draft', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'd1', userId: 'u1', data: { name: 'test' }, updatedAt: new Date() }]);
      const result = await svc.getCvDraft('u1');
      expect(result.id).toBe('d1');
    });
  });

  describe('saveCvDraft', () => {
    it('should save a cv draft', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      const result = await svc.saveCvDraft('u1', { name: 'test' });
      expect(result.userId).toBe('u1');
      expect(result.data).toEqual({ name: 'test' });
    });
  });

  describe('exportData', () => {
    it('should export user data with related records', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'u@t.com', company: null, applications: [],
        bids: [], freelanceJobs: [], contractsAsClient: [],
        contractsAsFreelancer: [], kycVerification: null,
      });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ enabled: true });

      const result = await svc.exportData('u1');
      expect(result.exportedAt).toBeDefined();
      expect(result.data.id).toBe('u1');
      expect(result.data.twoFactor).toEqual({ enabled: true });
    });

    it('should include twoFactor as null when not enrolled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'u@t.com', company: null, applications: [],
        bids: [], freelanceJobs: [], contractsAsClient: [],
        contractsAsFreelancer: [], kycVerification: null,
      });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);

      const result = await svc.exportData('u1');
      expect(result.data.twoFactor).toBeNull();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.exportData('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestDeletion', () => {
    it('should deactivate the account and return schedule info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await svc.requestDeletion('u1');
      expect(result.message).toContain('30 days');
      expect(result.scheduledAt).toBeDefined();
      expect(result.cancelDeadline).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.requestDeletion('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if already deactivated', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(svc.requestDeletion('u1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancelDeletion', () => {
    it('should reactivate the account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await svc.cancelDeletion('u1');
      expect(result.message).toContain('cancelled');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.cancelDeletion('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if already active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      await expect(svc.cancelDeletion('u1')).rejects.toThrow(ForbiddenException);
    });
  });
});
