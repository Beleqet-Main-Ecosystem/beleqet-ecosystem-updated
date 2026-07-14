import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { I18nService } from 'nestjs-i18n';
import { FraudAlertController } from './fraud-alert.controller';
import { QUEUE_NAMES } from '../queues/queues.constants';

const mockFraudQueue = {
  add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
};

const mockI18nService = {
  t: jest.fn().mockReturnValue('Translated message'),
};

describe('FraudAlertController', () => {
  let controller: FraudAlertController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FraudAlertController],
      providers: [
        { provide: getQueueToken(QUEUE_NAMES.FRAUD), useValue: mockFraudQueue },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    controller = module.get<FraudAlertController>(FraudAlertController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should enqueue user scan job', async () => {
    const result = await controller.scanUser('user-123');
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-user', { userId: 'user-123' });
  });

  it('should enqueue message scan job', async () => {
    const result = await controller.scanMessage('msg-456');
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-message', { messageId: 'msg-456' });
  });

  it('should enqueue transaction scan job', async () => {
    const result = await controller.scanTransaction('user-789');
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-transaction', { userId: 'user-789' });
  });

  it('should enqueue escrow transaction scan job', async () => {
    const result = await controller.scanEscrowTransaction('user-789');
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-escrow-transaction', { userId: 'user-789' });
  });

  it('should enqueue job scan job', async () => {
    const result = await controller.scanJob('job-001');
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-job', { jobId: 'job-001' });
  });

  it('should enqueue batch scan job', async () => {
    const result = await controller.scanAll();
    expect(result.jobId).toBe('test-job-id');
    expect(mockFraudQueue.add).toHaveBeenCalledWith('scan-all', { skip: 0, take: 100 });
  });
});
