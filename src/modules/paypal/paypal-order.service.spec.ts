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
 * Unit tests for PaypalOrderService.
 * All external HTTP and Prisma calls are mocked.
 */
describe('PaypalOrderService', () => {
  let service: PaypalOrderService;
  let prisma: jest.Mocked<PrismaService>;

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: string) => {
      const map: Record<string, string> = {
        PAYPAL_RETURN_URL: 'http://localhost:3000/success',
        PAYPAL_CANCEL_URL: 'http://localhost:3000/cancel',
      };
      return map[key] ?? def;
    }),
  };

  const mockPrisma = {
    paypalTransaction: {
      findUnique:  jest.fn(),
      findFirst:   jest.fn(),
      create:      jest.fn(),
      update:      jest.fn(),
    },
  };

  const baseDto: CreateOrderDto = {
    amount:   100,
    currency: 'USD',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalOrderService,
        { provide: PaypalAuthService, useValue: mockAuthService },
        { provide: ConfigService,     useValue: mockConfigService },
        { provide: PrismaService,     useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaypalOrderService>(PaypalOrderService);
    prisma  = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createOrder ────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates a PayPal order and returns transactionId + approveUrl', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.paypalTransaction.create.mockResolvedValue({
        id:           'local-tx-uuid',
        paypalOrderId: '5O190127TN364715T',
        amount:        100,
        currency:      'USD',
        platformFee:   5,
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          id:    '5O190127TN364715T',
          links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/checkoutnow?token=abc' }],
        },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.createOrder('client-uuid', baseDto);

      expect(result.orderId).toBe('5O190127TN364715T');
      expect(result.approveUrl).toContain('sandbox.paypal.com');
      expect(result.transactionId).toBe('local-tx-uuid');
      expect(result.platformFee).toBe(5); // 5% of 100
    });

    it('throws ConflictException when idempotency key already exists', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue({ id: 'existing-tx' });

      await expect(
        service.createOrder('client-uuid', { ...baseDto, idempotencyKey: 'duplicate-key' }),
      ).rejects.toThrow(ConflictException);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when PayPal API call fails', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockedAxios.post         = jest.fn().mockRejectedValueOnce({ response: { data: { name: 'INVALID_REQUEST' } } });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.createOrder('client-uuid', baseDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when PayPal returns no approve link', async () => {
      mockPrisma.paypalTransaction.findUnique.mockResolvedValue(null);
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({
        data: { id: 'ORDER-123', links: [{ rel: 'self', href: '...' }] }, // no 'approve' link
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.createOrder('client-uuid', baseDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── captureOrder ───────────────────────────────────────────────────────────

  describe('captureOrder', () => {
    const existingTx = {
      id:            'local-tx-uuid',
      paypalOrderId: '5O190127TN364715T',
      clientId:      'client-uuid',
      status:        'CREATED',
      amount:        100,
      currency:      'USD',
      paypalCaptureId: null,
    };

    it('captures an approved order and returns CAPTURED status', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(existingTx);
      mockPrisma.paypalTransaction.update.mockResolvedValue({
        ...existingTx,
        status:          'CAPTURED',
        paypalCaptureId: '3C679366HH908993F',
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          status:         'COMPLETED',
          purchase_units: [{ payments: { captures: [{ id: '3C679366HH908993F', status: 'COMPLETED' }] } }],
        },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.captureOrder('client-uuid', '5O190127TN364715T');

      expect(result.status).toBe('CAPTURED');
      expect(result.captureId).toBe('3C679366HH908993F');
    });

    it('returns cached CAPTURED result without calling PayPal again (idempotency)', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue({
        ...existingTx,
        status:          'CAPTURED',
        paypalCaptureId: '3C679366HH908993F',
      });

      const result = await service.captureOrder('client-uuid', '5O190127TN364715T');

      expect(result.status).toBe('CAPTURED');
      expect(mockedAxios.post).not.toHaveBeenCalled(); // no extra API call
    });

    it('throws NotFoundException when order does not belong to this client', async () => {
      mockPrisma.paypalTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.captureOrder('wrong-client', '5O190127TN364715T'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
