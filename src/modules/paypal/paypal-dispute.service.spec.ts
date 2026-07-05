import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import axios from 'axios';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalAuthService } from './paypal-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { RefundDto } from './dto/refund.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for PaypalDisputeService.
 * Covers refund issuance (full and partial) and dispute upsert logic.
 */
describe('PaypalDisputeService', () => {
  let service: PaypalDisputeService;
  let mockQueue: { add: jest.Mock };

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

  const mockPrisma = {
    paypalTransaction: {
      findFirst: jest.fn(),
      update:    jest.fn(),
    },
    paypalDispute: {
      upsert: jest.fn(),
    },
  };

  const existingTx = {
    id:              'local-tx-uuid',
    paypalCaptureId: '3C679366HH908993F',
    clientId:        'client-uuid',
    amount:          100,
    currency:        'USD',
    status:          'CAPTURED',
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalDisputeService,
        { provide: PaypalAuthService, useValue: mockAuthService },
        { provide: ConfigService,     useValue: { get: jest.fn() } },
        { provide: PrismaService,     useValue: mockPrisma },
        { provide: getQueueToken(QUEUE_NAMES.PAYPAL), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PaypalDisputeService>(PaypalDisputeService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── refund ─────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('issues a full refund and sets status to REFUNDED', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalTransaction.update.mockResolvedValue({
        ...existingTx,
        status:        'REFUNDED',
        refundedAmount: 100,
      });
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { id: 'REFUND-001', status: 'COMPLETED' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const dto: RefundDto = {}; // No amount = full refund
      const result = await service.refund('3C679366HH908993F', 'client-uuid', dto);

      expect(result.newTxStatus).toBe('REFUNDED');
      expect(result.refundId).toBe('REFUND-001');
      // Verify no 'amount' field was sent to PayPal (full refund)
      const callBody = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(callBody).not.toHaveProperty('amount');
    });

    it('issues a partial refund and sets status to PARTIALLY_REFUNDED', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalTransaction.update.mockResolvedValue({
        ...existingTx,
        status:        'PARTIALLY_REFUNDED',
        refundedAmount: 40,
      });
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { id: 'REFUND-002', status: 'COMPLETED' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const dto: RefundDto = { amount: 40, currency: 'USD', note: 'Partial delivery' };
      const result = await service.refund('3C679366HH908993F', 'client-uuid', dto);

      expect(result.newTxStatus).toBe('PARTIALLY_REFUNDED');
      expect(result.refundedAmount).toBe(40);
    });

    it('throws NotFoundException when capture does not belong to the client', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.refund('unknown-capture', 'client-uuid', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when PayPal rejects the refund', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockedAxios.post         = jest.fn().mockRejectedValueOnce({ response: { data: { name: 'REFUND_FAILED' } } });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.refund('3C679366HH908993F', 'client-uuid', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── upsertDispute ──────────────────────────────────────────────────────────

  describe('upsertDispute', () => {
    const disputePayload = {
      dispute_id:           'PP-D-12345',
      reason:               'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      status:               'OPEN',
      create_time:          '2026-07-05T10:00:00Z',
      dispute_transactions: [{ buyer_transaction_id: '3C679366HH908993F' }],
    };

    it('creates a new dispute record and enqueues a SYNC_DISPUTE job', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:             'dispute-local-uuid',
        paypalDisputeId: 'PP-D-12345',
        status:          'OPEN',
      });

      const result = await service.upsertDispute(disputePayload);

      expect(result.paypalDisputeId).toBe('PP-D-12345');
      expect(mockPrisma.paypalDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { paypalDisputeId: 'PP-D-12345' },
          create: expect.objectContaining({
            reason:      'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
            status:      'OPEN',
            transactionId: 'local-tx-uuid',
          }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('updates an existing dispute record on re-call (idempotency)', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:             'dispute-local-uuid',
        paypalDisputeId: 'PP-D-12345',
        status:          'UNDER_REVIEW',
      });

      const updatedPayload = { ...disputePayload, status: 'UNDER_REVIEW' };
      const result = await service.upsertDispute(updatedPayload);

      expect(result.status).toBe('UNDER_REVIEW');
    });
  });
});
