import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: Record<string, any> = {
  job: { findFirst: jest.fn() },
  application: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  eventLog: { create: jest.fn() },
  notification: { create: jest.fn() },
  $transaction: jest.fn((cb: (tx: any) => any) => cb(mockPrisma)),
};

const mockEventEmitter = { emit: jest.fn() };
const mockApplicationQueue = { add: jest.fn().mockResolvedValue({}) };
const mockAnalyticsQueue = { add: jest.fn().mockResolvedValue({}) };
const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };
const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    return fallback;
  }),
};

jest.mock('../notifications/email-templates', () => ({
  applicationReceivedEmail: jest.fn().mockResolvedValue({ html: '<p>test</p>', text: 'test' }),
  applicationStatusEmail: jest.fn().mockResolvedValue({ html: '<p>test</p>', text: 'test' }),
}));

describe('ApplicationsService', () => {
  let svc: ApplicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: getQueueToken('application-processing'), useValue: mockApplicationQueue },
        { provide: getQueueToken('analytics'), useValue: mockAnalyticsQueue },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    svc = module.get<ApplicationsService>(ApplicationsService);
  });

  describe('submit', () => {
    it('should throw NotFoundException if job not found', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);
      await expect(
        svc.submit('user-1', { jobId: 'j1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate application', async () => {
      mockPrisma.job.findFirst.mockResolvedValue({ id: 'j1', company: { name: 'Acme' }, companyId: 'c1', description: 'd', requirements: 'r' });
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        svc.submit('user-1', { jobId: 'j1' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should create application and emit event', async () => {
      const mockApp = {
        id: 'app-1', user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'j@t.com' },
        job: { id: 'j1', title: 'Dev', companyId: 'c1' },
      };
      mockPrisma.job.findFirst.mockResolvedValue({
        id: 'j1', company: { name: 'Acme' }, companyId: 'c1', description: 'd', requirements: 'r',
      });
      mockPrisma.application.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        mockPrisma.application.create.mockResolvedValue(mockApp);
        return cb(mockPrisma);
      });

      const result = await svc.submit('user-1', { jobId: 'j1' } as any);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('application.submitted', expect.any(Object));
      expect(mockApplicationQueue.add).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return user applications', async () => {
      mockPrisma.application.findMany.mockResolvedValue([{ id: 'app-1' }]);
      const result = await svc.findByUser('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findByJob', () => {
    it('should throw NotFoundException if employer does not own job', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);
      await expect(svc.findByJob('j1', 'emp-1')).rejects.toThrow(NotFoundException);
    });

    it('should return applications for a job', async () => {
      mockPrisma.job.findFirst.mockResolvedValue({ id: 'j1' });
      mockPrisma.application.findMany.mockResolvedValue([{ id: 'app-1' }]);
      const result = await svc.findByJob('j1', 'emp-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return an application', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      const result = await svc.findOne('app-1');
      expect(result.id).toBe('app-1');
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);
      await expect(svc.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException if application not found', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null);
      await expect(svc.updateStatus('app-1', 'SHORTLISTED', 'emp-1')).rejects.toThrow(NotFoundException);
    });

    it('should update status and create notification', async () => {
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-1', userId: 'user-1',
        user: { email: 'u@t.com', firstName: 'John' },
        job: { title: 'Dev' },
      });
      mockPrisma.application.update.mockResolvedValue({ id: 'app-1', status: 'SHORTLISTED' });

      const result = await svc.updateStatus('app-1', 'SHORTLISTED', 'emp-1');
      expect(result.status).toBe('SHORTLISTED');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('should throw NotFoundException if application cannot be withdrawn', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null);
      await expect(svc.withdraw('app-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should withdraw an application', async () => {
      mockPrisma.application.findFirst.mockResolvedValue({ id: 'app-1', status: 'SUBMITTED' });
      mockPrisma.application.update.mockResolvedValue({ id: 'app-1', status: 'WITHDRAWN' });

      const result = await svc.withdraw('app-1', 'user-1');
      expect(result.status).toBe('WITHDRAWN');
    });
  });
});
