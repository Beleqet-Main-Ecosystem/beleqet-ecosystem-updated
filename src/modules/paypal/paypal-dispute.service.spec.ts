import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import axios from 'axios';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalAuthService } from './paypal-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, PAYPAL_JOBS } from '../queues/queues.constants';
import { RefundDto } from './dto/refund.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for {@link PaypalDisputeService}.
 *
 * Covers:
 * - Full refund — sends no `amount` body to PayPal, derives status from `isPartial` flag
 * - Partial refund — sends `amount` body, note_to_payer, derives PARTIALLY_REFUNDED
 * - Atomic write — `$transaction` called once for PaypalRefund + PaypalTransaction update
 * - Mock mode — no API call, refund ID prefixed MOCK-REF-, $transaction still called
 * - Ownership check — `NotFoundException` for wrong client
 * - PayPal API failure — `BadRequestException`, `$transaction` NOT called
 * - Dispute upsert — creates new record linked to transaction
 * - Dispute upsert idempotency — updates existing record
 * - SYNC_DISPUTE job enqueued with 5-minute delay
 * - Orphan dispute — `transactionId: null` when buyer_transaction_id not found
 * - Status mapping — exhaustive check for all 6 known statuses + unknown fallback
 */
describe('PaypalDisputeService', () => {
  let service: PaypalDisputeService;
  let mockQueue: { add: jest.Mock };

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

  /** Standard captured transaction used as the refund target */
  const existingTx = {
    id:              'local-tx-uuid',
    paypalCaptureId: '3C679366HH908993F',
    clientId:        'client-uuid',
    amount:          100,
    currency:        'USD',
    status:          'CAPTURED',
  };

  const makeMockPrisma = () => ({
    paypalTransaction: {
      findFirst: jest.fn(),
      update:    jest.fn(),
    },
    paypalRefund: {
      create: jest.fn(),
    },
    paypalDispute: {
      upsert: jest.fn(),
    },
    // Prisma interactive transaction — returns void[] for batch operations
    $transaction: jest.fn().mockResolvedValue([undefined, undefined]),
  });

  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  const makeMockConfigService = (mode = 'sandbox') => ({
    get: jest.fn((key: string) => (key === 'PAYPAL_MODE' ? mode : undefined)),
  });

  const buildModule = async (mode = 'sandbox') => {
    mockPrisma = makeMockPrisma();
    mockQueue  = { add: jest.fn().mockResolvedValue({}) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalDisputeService,
        { provide: PaypalAuthService,                 useValue: mockAuthService },
        { provide: ConfigService,                     useValue: makeMockConfigService(mode) },
        { provide: PrismaService,                     useValue: mockPrisma },
        { provide: getQueueToken(QUEUE_NAMES.PAYPAL), useValue: mockQueue },
      ],
    }).compile();

    service = moduleRef.get<PaypalDisputeService>(PaypalDisputeService);
  };

  beforeEach(async () => {
    await buildModule('sandbox');
  });

  afterEach(() => jest.clearAllMocks());

  // ── refund — sandbox mode ───────────────────────────────────────────────────

  describe('refund (sandbox)', () => {
    beforeEach(() => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
    });

    it('issues a full refund, sets status REFUNDED, and writes an audit row', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'REFUND-001', status: 'COMPLETED' },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.refund('3C679366HH908993F', 'client-uuid', {});

      // Service derives newTxStatus from `isPartial` flag (no dto.amount => REFUNDED)
      expect(result.newTxStatus).toBe('REFUNDED');
      // refundId comes from PayPal response.data.id
      expect(result.refundId).toBe('REFUND-001');
      // refundedAmount falls back to tx.amount when no dto.amount given
      expect(result.refundedAmount).toBe(100);
      // Atomic write: $transaction called once
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // Full refund sends no amount field to PayPal
      const paypalCallBody = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(paypalCallBody).not.toHaveProperty('amount');
    });

    it('issues a partial refund and sets PARTIALLY_REFUNDED', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'REFUND-002', status: 'COMPLETED' },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const dto: RefundDto = { amount: 40, currency: 'USD', note: 'Partial delivery' };
      const result = await service.refund('3C679366HH908993F', 'client-uuid', dto);

      // Service derives PARTIALLY_REFUNDED because dto.amount is defined
      expect(result.newTxStatus).toBe('PARTIALLY_REFUNDED');
      // refundedAmount is dto.amount for partial refunds
      expect(result.refundedAmount).toBe(40);
      // PayPal body includes the amount object
      const paypalCallBody = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(paypalCallBody).toHaveProperty('amount');
      expect(paypalCallBody.amount.value).toBe('40.00');
      expect(paypalCallBody.amount.currency_code).toBe('USD');
    });

    it('sends note_to_payer when a note is provided', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'REFUND-003', status: 'COMPLETED' },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.refund('3C679366HH908993F', 'client-uuid', {
        note: 'Client cancelled before delivery started',
      });

      const paypalCallBody = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(paypalCallBody).toHaveProperty(
        'note_to_payer',
        'Client cancelled before delivery started',
      );
    });

    it('calls $transaction once to atomically update tx and create audit refund row', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'REFUND-004', status: 'COMPLETED' },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.refund('3C679366HH908993F', 'client-uuid', {});

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // $transaction receives an array of two Prisma operations
      const batchArg = (mockPrisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(batchArg)).toBe(true);
      expect(batchArg).toHaveLength(2);
    });

    it('throws NotFoundException when capture does not belong to the client', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.refund('unknown-capture', 'client-uuid', {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when PayPal rejects the refund', async () => {
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'REFUND_CAPTURE_CURRENCY_MISMATCH' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.refund('3C679366HH908993F', 'client-uuid', {}),
      ).rejects.toThrow(BadRequestException);

      // $transaction must NOT be called when the API call fails
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── refund — mock mode ──────────────────────────────────────────────────────

  describe('refund (mock mode)', () => {
    beforeEach(async () => {
      await buildModule('mock');
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
    });

    it('issues refund without calling PayPal API in mock mode', async () => {
      const result = await service.refund('3C679366HH908993F', 'client-uuid', {});

      expect(result.refundId).toMatch(/^MOCK-REF-/);
      expect(result.newTxStatus).toBe('REFUNDED');
      expect(mockedAxios.post).not.toHaveBeenCalled();
      // $transaction still called to create the audit row
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('returns PARTIALLY_REFUNDED for partial refund in mock mode', async () => {
      const dto: RefundDto = { amount: 30, currency: 'USD' };
      const result = await service.refund('3C679366HH908993F', 'client-uuid', dto);

      expect(result.newTxStatus).toBe('PARTIALLY_REFUNDED');
      expect(result.refundedAmount).toBe(30);
      expect(mockedAxios.post).not.toHaveBeenCalled();
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

    it('creates a new dispute linked to a matching local transaction', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:              'dispute-local-uuid',
        paypalDisputeId: 'PP-D-12345',
        status:          'OPEN',
      });

      const result = await service.upsertDispute(disputePayload);

      expect(result.paypalDisputeId).toBe('PP-D-12345');
      expect(mockPrisma.paypalDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { paypalDisputeId: 'PP-D-12345' },
          create: expect.objectContaining({
            reason:        'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
            status:        'OPEN',
            transactionId: 'local-tx-uuid',
          }),
        }),
      );
    });

    it('upserts with null transactionId when buyer_transaction_id is not found locally', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:              'dispute-orphan-uuid',
        paypalDisputeId: 'PP-D-99999',
        status:          'OPEN',
      });

      await service.upsertDispute({ ...disputePayload, dispute_id: 'PP-D-99999' });

      expect(mockPrisma.paypalDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ transactionId: null }),
        }),
      );
    });

    it('updates an existing dispute on re-call (idempotency via Prisma upsert)', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:              'dispute-local-uuid',
        paypalDisputeId: 'PP-D-12345',
        status:          'UNDER_REVIEW',
      });

      const result = await service.upsertDispute({
        ...disputePayload,
        status: 'UNDER_REVIEW',
      });

      expect(result.status).toBe('UNDER_REVIEW');
      expect(mockPrisma.paypalDispute.upsert).toHaveBeenCalledTimes(1);
    });

    it('enqueues a SYNC_DISPUTE job with a 5-minute delay after upsert', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:              'dispute-local-uuid',
        paypalDisputeId: 'PP-D-12345',
        status:          'OPEN',
      });

      await service.upsertDispute(disputePayload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PAYPAL_JOBS.SYNC_DISPUTE,
        expect.objectContaining({ disputeId: 'PP-D-12345' }),
        expect.objectContaining({ delay: 5 * 60 * 1_000 }),
      );
    });

    it('falls back to OPEN for unknown PayPal status strings', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.paypalDispute.upsert.mockResolvedValue({
        id:              'dispute-uuid',
        paypalDisputeId: 'PP-D-UNKNOWN',
        status:          'OPEN',
      });

      await service.upsertDispute({
        ...disputePayload,
        dispute_id: 'PP-D-UNKNOWN',
        status:     'SOME_FUTURE_PAYPAL_STATUS_XYZ',
      });

      expect(mockPrisma.paypalDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });

    it('correctly maps all 6 known PayPal dispute statuses', async () => {
      const statusMap: [string, string][] = [
        ['OPEN',                        'OPEN'],
        ['WAITING_FOR_BUYER_RESPONSE',  'WAITING_FOR_BUYER_RESPONSE'],
        ['WAITING_FOR_SELLER_RESPONSE', 'WAITING_FOR_SELLER_RESPONSE'],
        ['UNDER_REVIEW',                'UNDER_REVIEW'],
        ['RESOLVED',                    'RESOLVED'],
        ['CANCELLED',                   'CANCELLED'],
      ];

      for (const [paypalStatus, expectedLocal] of statusMap) {
        mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);
        mockPrisma.paypalDispute.upsert.mockResolvedValue({
          id:              `dispute-${paypalStatus}`,
          paypalDisputeId: `PP-D-${paypalStatus}`,
          status:          expectedLocal,
        });

        await service.upsertDispute({
          ...disputePayload,
          dispute_id: `PP-D-${paypalStatus}`,
          status:     paypalStatus,
        });

        expect(mockPrisma.paypalDispute.upsert).toHaveBeenLastCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ status: expectedLocal }),
          }),
        );
      }
    });
  });
});
