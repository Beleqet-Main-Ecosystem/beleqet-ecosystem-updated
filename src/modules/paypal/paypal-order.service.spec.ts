import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PaypalOrderService } from './paypal-order.service';
import { PaypalAuthService } from './paypal-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for {@link PaypalOrderService}.
 *
 * Covers:
 * - Order creation (sandbox mode with PayPal API call)
 * - Order creation in mock mode (no API call, returns simulator URL)
 * - ETB currency guard (blocked in non-mock modes)
 * - Idempotency key collision (`ConflictException`)
 * - Missing approve link (`BadRequestException`)
 * - PayPal API failure (`BadRequestException`)
 * - Capture order happy path
 * - Capture idempotency (already captured → no API call)
 * - Ownership check (`NotFoundException` for wrong client)
 * - GDPR: `sanitiseForStorage` is called before DB persistence
 */
describe('PaypalOrderService', () => {
  let service: PaypalOrderService;
  let prisma: jest.Mocked<PrismaService>;

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

  /** Default sandbox ConfigService mock — overridden per test for mock mode */
  const makeMockConfigService = (mode = 'sandbox') => ({
    get: jest.fn((key: string, def?: string) => {
      const map: Record<string, string> = {
        PAYPAL_MODE:       mode,
        PAYPAL_RETURN_URL: 'http://localhost:3000/success',
        PAYPAL_CANCEL_URL: 'http://localhost:3000/cancel',
        FRONTEND_URL:      'http://localhost:3000',
      };
      return map[key] ?? def;
    }),
  });

  const mockPrisma = {
    paypalTransaction: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
    },
  };

  const baseDto: CreateOrderDto = {
    amount:   100,
    currency: 'USD',
  };

  /** A complete sandbox PayPal Orders API response */
  const paypalOrderResponse = {
    data: {
      id:    '5O190127TN364715T',
      links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/checkoutnow?token=abc' }],
    },
  };

  /** The persisted transaction row returned from prisma.create */
  const createdTx = {
    id:           'local-tx-uuid',
    paypalOrderId: '5O190127TN364715T',
    amount:        100,
    currency:      'USD',
    platformFee:   5,
  };

  const buildModule = async (mode = 'sandbox') => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalOrderService,
        { provide: PaypalAuthService, useValue: mockAuthService },
        { provide: ConfigService,     useValue: makeMockConfigService(mode) },
        { provide: PrismaService,     useValue: mockPrisma },
      ],
    }).compile();

    service = moduleRef.get<PaypalOrderService>(PaypalOrderService);
    prisma  = moduleRef.get(PrismaService);
  };

  beforeEach(async () => {
    await buildModule('sandbox');
  });

  afterEach(() => jest.clearAllMocks());

  // ── createOrder — sandbox mode ──────────────────────────────────────────────

  describe('createOrder (sandbox)', () => {
    it('creates a PayPal order and returns transactionId + approveUrl', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue(createdTx);
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalOrderResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.createOrder('client-uuid', baseDto);

      expect(result.orderId).toBe('5O190127TN364715T');
      expect(result.approveUrl).toContain('sandbox.paypal.com');
      expect(result.transactionId).toBe('local-tx-uuid');
      expect(result.platformFee).toBeCloseTo(5); // 5% of 100
    });

    it('calculates platform fee at exactly 5% of the amount', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue({ ...createdTx, platformFee: 12.5 });
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalOrderResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.createOrder('client-uuid', { amount: 250, currency: 'USD' });

      // Verify the create call received the correct platform fee
      const createArg = (mockPrisma.paypalTransaction.create as jest.Mock).mock.calls[0][0].data;
      expect(createArg.platformFee).toBeCloseTo(12.5); // 5% of 250
      expect(result.transactionId).toBeDefined();
    });

    it('sends the idempotencyKey as PayPal-Request-Id header', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue(createdTx);
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalOrderResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.createOrder('client-uuid', { ...baseDto, idempotencyKey: 'my-key-abc' });

      const headers = (mockedAxios.post as jest.Mock).mock.calls[0][2].headers;
      expect(headers['PayPal-Request-Id']).toBe('my-key-abc');
    });

    it('persists gatewayResponse to the DB after PII sanitisation', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue(createdTx);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          ...paypalOrderResponse.data,
          payer: { email_address: 'buyer@example.com', name: { given_name: 'John' } },
        },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.createOrder('client-uuid', baseDto);

      const createArg = (mockPrisma.paypalTransaction.create as jest.Mock).mock.calls[0][0].data;
      // The raw email should NOT be stored — it should be hashed/redacted
      const storedResponse = JSON.stringify(createArg.gatewayResponse);
      expect(storedResponse).not.toContain('buyer@example.com');
    });

    it('throws ConflictException when idempotency key already exists', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue({ id: 'existing-tx' });

      await expect(
        service.createOrder('client-uuid', { ...baseDto, idempotencyKey: 'dup-key' }),
      ).rejects.toThrow(ConflictException);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when PayPal API rejects the request', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'INVALID_REQUEST' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(service.createOrder('client-uuid', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when PayPal response has no approve link', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'ORDER-NO-LINK', links: [{ rel: 'self', href: '...' }] },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(service.createOrder('client-uuid', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for ETB currency in sandbox mode', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('client-uuid', { amount: 5000, currency: 'ETB' }),
      ).rejects.toThrow(BadRequestException);

      // PayPal API should never be called for blocked currencies
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  // ── createOrder — mock mode ────────────────────────────────────────────────

  describe('createOrder (mock mode)', () => {
    beforeEach(async () => {
      await buildModule('mock');
    });

    it('creates a mock order without calling PayPal API', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue({
        ...createdTx,
        paypalOrderId: 'MOCK-ORD-123',
      });

      const result = await service.createOrder('client-uuid', baseDto);

      expect(result.orderId).toMatch(/^MOCK-ORD-/);
      expect(result.approveUrl).toContain('paypal-mock-checkout');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('accepts ETB currency in mock mode without throwing', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue({
        ...createdTx,
        currency: 'ETB',
      });

      await expect(
        service.createOrder('client-uuid', { amount: 5000, currency: 'ETB' }),
      ).resolves.not.toThrow();

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('generates a unique mock order ID on each call', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue(createdTx);

      const result1 = await service.createOrder('client-uuid', baseDto);

      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue(createdTx);

      // Add small delay to ensure different timestamp-based IDs
      await new Promise((r) => setTimeout(r, 5));
      const result2 = await service.createOrder('client-uuid', baseDto);

      expect(result1.orderId).not.toBe(result2.orderId);
    });
  });

  // ── captureOrder ───────────────────────────────────────────────────────────

  describe('captureOrder', () => {
    const existingTx = {
      id:              'local-tx-uuid',
      paypalOrderId:   '5O190127TN364715T',
      clientId:        'client-uuid',
      status:          'CREATED',
      amount:          100,
      currency:        'USD',
      paypalCaptureId: null,
    };

    const captureApiResponse = {
      data: {
        status:         'COMPLETED',
        purchase_units: [
          { payments: { captures: [{ id: '3C679366HH908993F', status: 'COMPLETED' }] } },
        ],
      },
    };

    it('captures an approved order and updates status to CAPTURED', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalTransaction.update.mockResolvedValue({
        ...existingTx,
        status:          'CAPTURED',
        paypalCaptureId: '3C679366HH908993F',
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce(captureApiResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.captureOrder('client-uuid', '5O190127TN364715T');

      expect(result.status).toBe('CAPTURED');
      expect(result.captureId).toBe('3C679366HH908993F');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v2/checkout/orders/5O190127TN364715T/capture'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns cached CAPTURED result without calling PayPal again (idempotency)', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue({
        ...existingTx,
        status:          'CAPTURED',
        paypalCaptureId: '3C679366HH908993F',
      });

      const result = await service.captureOrder('client-uuid', '5O190127TN364715T');

      expect(result.status).toBe('CAPTURED');
      expect(result.captureId).toBe('3C679366HH908993F');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('marks the transaction FAILED when PayPal reports a non-COMPLETED status', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalTransaction.update.mockResolvedValue({
        ...existingTx,
        status: 'FAILED',
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          status:         'VOIDED',
          purchase_units: [{ payments: { captures: [{ id: '', status: 'VOIDED' }] } }],
        },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.captureOrder('client-uuid', '5O190127TN364715T');

      expect(result.status).toBe('FAILED');
    });

    it('throws NotFoundException when order does not belong to this client', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.captureOrder('wrong-client', '5O190127TN364715T'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when PayPal capture API fails', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'ORDER_NOT_APPROVED' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.captureOrder('client-uuid', '5O190127TN364715T'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
