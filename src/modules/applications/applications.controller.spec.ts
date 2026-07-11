import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { UsersService } from '../users/users.service';

const mockSvc = {
  submit: jest.fn(),
  findByUser: jest.fn(),
  findByJob: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
  withdraw: jest.fn(),
};

const mockUsersSvc = {
  addClientFeedback: jest.fn(),
  verifySkill: jest.fn(),
};

describe('ApplicationsController', () => {
  let controller: ApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: mockSvc },
        { provide: UsersService, useValue: mockUsersSvc },
      ],
    }).compile();
    controller = module.get<ApplicationsController>(ApplicationsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submit', () => {
    it('should submit an application', async () => {
      mockSvc.submit.mockResolvedValue({ id: 'app-1' });
      const result = await controller.submit(
        { userId: 'u1', email: 'e', role: 'JOB_SEEKER' },
        { jobId: 'j1' } as any,
      );
      expect(result.id).toBe('app-1');
    });
  });

  describe('myApplications', () => {
    it('should return user applications', async () => {
      mockSvc.findByUser.mockResolvedValue([{ id: 'app-1' }]);
      const result = await controller.myApplications({ userId: 'u1', email: 'e', role: 'JOB_SEEKER' });
      expect(result).toHaveLength(1);
    });
  });

  describe('byJob', () => {
    it('should return job applications', async () => {
      mockSvc.findByJob.mockResolvedValue([{ id: 'app-1' }]);
      const result = await controller.byJob('j1', { userId: 'emp-1', email: 'e', role: 'EMPLOYER' });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return an application', async () => {
      mockSvc.findOne.mockResolvedValue({ id: 'app-1' });
      const result = await controller.findOne('app-1');
      expect(result.id).toBe('app-1');
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      mockSvc.updateStatus.mockResolvedValue({ id: 'app-1', status: 'SHORTLISTED' });
      const result = await controller.updateStatus(
        'app-1',
        { status: 'SHORTLISTED' as any },
        { userId: 'emp-1', email: 'e', role: 'EMPLOYER' },
      );
      expect(result.status).toBe('SHORTLISTED');
    });
  });

  describe('withdraw', () => {
    it('should withdraw an application', async () => {
      mockSvc.withdraw.mockResolvedValue({ id: 'app-1', status: 'WITHDRAWN' });
      const result = await controller.withdraw('app-1', { userId: 'u1', email: 'e', role: 'JOB_SEEKER' });
      expect(result.status).toBe('WITHDRAWN');
    });
  });

  describe('addFeedback', () => {
    it('should delegate to users service', async () => {
      mockUsersSvc.addClientFeedback.mockResolvedValue({ id: 'u1' });
      const result = await controller.addFeedback('u1', { rating: 5 });
      expect(mockUsersSvc.addClientFeedback).toHaveBeenCalledWith('u1', { rating: 5 });
    });
  });

  describe('verifySkill', () => {
    it('should delegate to users service', async () => {
      mockUsersSvc.verifySkill.mockResolvedValue({ id: 'u1', skillVerified: true });
      const result = await controller.verifySkill('u1', true);
      expect(mockUsersSvc.verifySkill).toHaveBeenCalledWith('u1', true);
    });
  });
});
