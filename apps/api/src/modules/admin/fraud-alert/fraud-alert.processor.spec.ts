import { Test, TestingModule } from '@nestjs/testing';
import { FraudAlertProcessor } from './fraud-alert.processor';
import { FraudAlertService } from './fraud-alert.service';

const mockFraudAlertService = {
  scanUser: jest.fn().mockResolvedValue([]),
  scanMessage: jest.fn().mockResolvedValue([]),
  scanTransaction: jest.fn().mockResolvedValue([]),
  scanEscrowTransactions: jest.fn().mockResolvedValue([]),
  scanJob: jest.fn().mockResolvedValue([]),
  scanAll: jest.fn().mockResolvedValue(0),
};

describe('FraudAlertProcessor', () => {
  let processor: FraudAlertProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudAlertProcessor,
        { provide: FraudAlertService, useValue: mockFraudAlertService },
      ],
    }).compile();

    processor = module.get<FraudAlertProcessor>(FraudAlertProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should delegate scan user to service', async () => {
    const job = { data: { userId: 'user-1' } } as never;
    await processor.handleScanUser(job);
    expect(mockFraudAlertService.scanUser).toHaveBeenCalledWith('user-1');
  });

  it('should delegate scan message to service', async () => {
    const job = { data: { messageId: 'msg-1' } } as never;
    await processor.handleScanMessage(job);
    expect(mockFraudAlertService.scanMessage).toHaveBeenCalledWith('msg-1');
  });

  it('should delegate scan transaction to service', async () => {
    const job = { data: { userId: 'user-2' } } as never;
    await processor.handleScanTransaction(job);
    expect(mockFraudAlertService.scanTransaction).toHaveBeenCalledWith('user-2');
  });

  it('should delegate escrow transaction scan to service', async () => {
    const job = { data: { userId: 'user-3' } } as never;
    await processor.handleScanEscrowTransaction(job);
    expect(mockFraudAlertService.scanEscrowTransactions).toHaveBeenCalledWith('user-3');
  });

  it('should delegate scan job to service', async () => {
    const job = { data: { jobId: 'job-5' } } as never;
    await processor.handleScanJob(job);
    expect(mockFraudAlertService.scanJob).toHaveBeenCalledWith('job-5');
  });

  it('should delegate scan all to service', async () => {
    const job = { data: { skip: 0, take: 50 } } as never;
    await processor.handleScanAll(job);
    expect(mockFraudAlertService.scanAll).toHaveBeenCalledWith({ skip: 0, take: 50 });
  });
});
