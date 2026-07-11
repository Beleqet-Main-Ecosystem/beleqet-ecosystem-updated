import { Test, TestingModule } from '@nestjs/testing';
import { FreelanceController } from './freelance.controller';
import { FreelanceService } from './freelance.service';
import { EscrowService } from '../escrow/escrow.service';

const mockSvc = {
  createJob: jest.fn(),
  findJobs: jest.fn(),
  findJobById: jest.fn(),
  submitBid: jest.fn(),
  acceptBid: jest.fn(),
  rejectBid: jest.fn(),
  getMyBids: jest.fn(),
  getMyContracts: jest.fn(),
  getContract: jest.fn(),
  createMilestone: jest.fn(),
};

const mockEscrowSvc = {
  releaseMilestone: jest.fn(),
};

const mockUser = { userId: 'u1', email: 'u@t.com', role: 'FREELANCER' };

describe('FreelanceController', () => {
  let controller: FreelanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FreelanceController],
      providers: [
        { provide: FreelanceService, useValue: mockSvc },
        { provide: EscrowService, useValue: mockEscrowSvc },
      ],
    }).compile();
    controller = module.get<FreelanceController>(FreelanceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findJobs should return jobs', async () => {
    mockSvc.findJobs.mockResolvedValue({ items: [] });
    const result = await controller.findJobs({});
    expect(result.items).toEqual([]);
  });

  it('findJob should return a job', async () => {
    mockSvc.findJobById.mockResolvedValue({ id: 'g1' });
    const result = await controller.findJob('g1');
    expect(result.id).toBe('g1');
  });

  it('createJob should create a gig', async () => {
    mockSvc.createJob.mockResolvedValue({ id: 'g1' });
    const result = await controller.createJob(mockUser, { title: 'Test' } as any);
    expect(result.id).toBe('g1');
  });

  it('submitBid should create a bid', async () => {
    mockSvc.submitBid.mockResolvedValue({ id: 'b1' });
    const result = await controller.submitBid('g1', mockUser, { amount: 1000 } as any);
    expect(result.id).toBe('b1');
  });

  it('acceptBid should accept a bid', async () => {
    mockSvc.acceptBid.mockResolvedValue({ id: 'c1' });
    const result = await controller.acceptBid('b1', mockUser);
    expect(result.id).toBe('c1');
  });

  it('rejectBid should reject a bid', async () => {
    mockSvc.rejectBid.mockResolvedValue({ id: 'b1', status: 'REJECTED' });
    const result = await controller.rejectBid('b1', mockUser);
    expect(result.status).toBe('REJECTED');
  });

  it('myBids should return bids', async () => {
    mockSvc.getMyBids.mockResolvedValue([]);
    const result = await controller.myBids(mockUser);
    expect(result).toEqual([]);
  });

  it('myContracts should return contracts', async () => {
    mockSvc.getMyContracts.mockResolvedValue([]);
    const result = await controller.myContracts(mockUser);
    expect(result).toEqual([]);
  });

  it('contract should return a contract', async () => {
    mockSvc.getContract.mockResolvedValue({ id: 'c1' });
    const result = await controller.contract('c1');
    expect(result.id).toBe('c1');
  });

  it('createMilestone should create a milestone', async () => {
    mockSvc.createMilestone.mockResolvedValue({ id: 'm1' });
    const result = await controller.createMilestone('c1', mockUser, { title: 'Phase 1' } as any);
    expect(result.id).toBe('m1');
  });

  it('approveMilestone should delegate to escrow service', async () => {
    mockEscrowSvc.releaseMilestone.mockResolvedValue({ success: true });
    const result = await controller.approveMilestone('m1', mockUser);
    expect(result.success).toBe(true);
  });
});
