import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PaypalSubscriptionService } from './paypal-subscription.service';
import { PaypalAuthService } from './paypal-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for {@link PaypalSubscriptionService}.
 *
 * Covers:
 * - Subscription creation (sandbox mode with PayPal API call)
 * - Subscription creation (mock mode — no API call, simulator URL returned)
 * - Missing approve link → `BadRequestException`
 * - PayPal API failure → `BadRequestException`
 * - Subscription suspended successfully
 * - Subscription cancelled successfully
 * - Suspend/cancel when subscription not found → `NotFoundException`
 * - GDPR: PII sanitised in gatewayResponse before DB write
 */
describe('PaypalSubscriptionService', () => {
  let service: PaypalSubscriptionService;

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

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

  const makeMockPrisma = () => ({
    paypalSubscription: {
      create:     jest.fn(),
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
  });

  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  /** The row returned after subscription creation */
  const createdSubscription = {
    id:                   'sub-local-uuid',
    paypalSubscriptionId: 'I-BW452GLLEP1G',
    paypalPlanId:         'P-5ML4271244454362WXNWU5NQ',
    status:               'APPROVAL_PENDING',
    userId:               'user-uuid',
  };

  const paypalApiResponse = {
    data: {
      id:    'I-BW452GLLEP1G',
      links: [
        { rel: 'approve', href: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-TOKEN' },
      ],
    },
  };

  const baseDto: CreateSubscriptionDto = {
    planId:    'P-5ML4271244454362WXNWU5NQ',
    planLabel: 'MONTHLY',
  };

  const buildModule = async (mode = 'sandbox') => {
    mockPrisma = makeMockPrisma();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalSubscriptionService,
        { provide: PaypalAuthService, useValue: mockAuthService },
        { provide: ConfigService,     useValue: makeMockConfigService(mode) },
        { provide: PrismaService,     useValue: mockPrisma },
      ],
    }).compile();

    service = moduleRef.get<PaypalSubscriptionService>(PaypalSubscriptionService);
  };

  beforeEach(async () => {
    await buildModule('sandbox');
  });

  afterEach(() => jest.clearAllMocks());

  // ── createSubscription — sandbox ─────────────────────────────────────────────

  describe('createSubscription (sandbox)', () => {
    it('creates a subscription and returns localId + subscriptionId + approveUrl', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalApiResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.createSubscription('user-uuid', baseDto);

      expect(result.subscriptionId).toBe('I-BW452GLLEP1G');
      expect(result.localId).toBe('sub-local-uuid');
      expect(result.approveUrl).toContain('sandbox.paypal.com');
      expect(result.planId).toBe('P-5ML4271244454362WXNWU5NQ');
      expect(result.planLabel).toBe('MONTHLY');
    });

    it('persists status as APPROVAL_PENDING after creation', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalApiResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.createSubscription('user-uuid', baseDto);

      const createArg = (mockPrisma.paypalSubscription.create as jest.Mock).mock.calls[0][0].data;
      expect(createArg.status).toBe('APPROVAL_PENDING');
      expect(createArg.userId).toBe('user-uuid');
    });

    it('sends the correct plan_id in the PayPal API body', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);
      mockedAxios.post = jest.fn().mockResolvedValueOnce(paypalApiResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.createSubscription('user-uuid', baseDto);

      const apiCallBody = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(apiCallBody.plan_id).toBe('P-5ML4271244454362WXNWU5NQ');
    });

    it('sanitises PII in gatewayResponse before writing to DB', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          ...paypalApiResponse.data,
          subscriber: { email_address: 'subscriber@test.com', name: { given_name: 'Alice' } },
        },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.createSubscription('user-uuid', baseDto);

      const createArg = (mockPrisma.paypalSubscription.create as jest.Mock).mock.calls[0][0].data;
      const stored = JSON.stringify(createArg.gatewayResponse);
      expect(stored).not.toContain('subscriber@test.com');
      expect(stored).not.toContain('Alice');
    });

    it('throws BadRequestException when PayPal returns no approve link', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { id: 'I-NO-LINK', links: [{ rel: 'self', href: '...' }] },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(service.createSubscription('user-uuid', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the PayPal API call fails', async () => {
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'BUSINESS_ERROR' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(service.createSubscription('user-uuid', baseDto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── createSubscription — mock mode ──────────────────────────────────────────

  describe('createSubscription (mock mode)', () => {
    beforeEach(async () => {
      await buildModule('mock');
    });

    it('creates a mock subscription without calling PayPal API', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue({
        ...createdSubscription,
        paypalSubscriptionId: 'MOCK-SUB-123',
      });

      const result = await service.createSubscription('user-uuid', baseDto);

      expect(result.subscriptionId).toMatch(/^MOCK-SUB-/);
      expect(result.approveUrl).toContain('paypal-mock-checkout');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('includes planId in the simulator URL query string', async () => {
      mockPrisma.paypalSubscription.create.mockResolvedValue(createdSubscription);

      const result = await service.createSubscription('user-uuid', baseDto);

      expect(result.approveUrl).toContain('planId=P-5ML4271244454362WXNWU5NQ');
    });
  });

  // ── suspendSubscription ──────────────────────────────────────────────────────

  describe('suspendSubscription', () => {
    const existingRecord = {
      id:                   'sub-local-uuid',
      paypalSubscriptionId: 'I-BW452GLLEP1G',
      userId:               'user-uuid',
      status:               'ACTIVE',
    };

    it('suspends an active subscription and sets status to SUSPENDED', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.paypalSubscription.update.mockResolvedValue({
        ...existingRecord,
        status:      'SUSPENDED',
        suspendedAt: new Date(),
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.suspendSubscription('user-uuid', 'I-BW452GLLEP1G');

      expect(result.status).toBe('SUSPENDED');
      expect(result.suspendedAt).toBeInstanceOf(Date);
    });

    it('calls the correct PayPal suspend endpoint', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.paypalSubscription.update.mockResolvedValue({ ...existingRecord, status: 'SUSPENDED' });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.suspendSubscription('user-uuid', 'I-BW452GLLEP1G');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/billing/subscriptions/I-BW452GLLEP1G/suspend'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when subscription not found for this user', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(null);

      await expect(
        service.suspendSubscription('user-uuid', 'I-DOES-NOT-EXIST'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when PayPal suspend API fails', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'SUBSCRIPTION_NOT_ACTIVE' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.suspendSubscription('user-uuid', 'I-BW452GLLEP1G'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancelSubscription ───────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    const existingRecord = {
      id:                   'sub-local-uuid',
      paypalSubscriptionId: 'I-BW452GLLEP1G',
      userId:               'user-uuid',
      status:               'ACTIVE',
    };

    it('cancels a subscription and sets status to CANCELLED', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.paypalSubscription.update.mockResolvedValue({
        ...existingRecord,
        status:      'CANCELLED',
        cancelledAt: new Date(),
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const result = await service.cancelSubscription('user-uuid', 'I-BW452GLLEP1G');

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('calls the correct PayPal cancel endpoint', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.paypalSubscription.update.mockResolvedValue({ ...existingRecord, status: 'CANCELLED' });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.cancelSubscription('user-uuid', 'I-BW452GLLEP1G');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/billing/subscriptions/I-BW452GLLEP1G/cancel'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws NotFoundException when subscription not found for this user', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('other-user', 'I-BW452GLLEP1G'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when PayPal cancel API fails', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue(existingRecord);
      mockedAxios.post = jest.fn().mockRejectedValueOnce({
        response: { data: { name: 'INVALID_RESOURCE_ID' } },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(
        service.cancelSubscription('user-uuid', 'I-BW452GLLEP1G'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Mock mode suspend/cancel ─────────────────────────────────────────────────

  describe('suspend/cancel (mock mode — no API call)', () => {
    beforeEach(async () => {
      await buildModule('mock');
    });

    it('suspends without calling PayPal API in mock mode', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue({
        id:                   'sub-uuid',
        paypalSubscriptionId: 'MOCK-SUB-123',
        userId:               'user-uuid',
        status:               'ACTIVE',
      });
      mockPrisma.paypalSubscription.update.mockResolvedValue({
        id:                   'sub-uuid',
        paypalSubscriptionId: 'MOCK-SUB-123',
        userId:               'user-uuid',
        status:               'SUSPENDED',
        suspendedAt:          new Date(),
      });

      const result = await service.suspendSubscription('user-uuid', 'MOCK-SUB-123');

      expect(result.status).toBe('SUSPENDED');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('cancels without calling PayPal API in mock mode', async () => {
      mockPrisma.paypalSubscription.findFirst.mockResolvedValue({
        id:                   'sub-uuid',
        paypalSubscriptionId: 'MOCK-SUB-456',
        userId:               'user-uuid',
        status:               'ACTIVE',
      });
      mockPrisma.paypalSubscription.update.mockResolvedValue({
        id:                   'sub-uuid',
        paypalSubscriptionId: 'MOCK-SUB-456',
        userId:               'user-uuid',
        status:               'CANCELLED',
        cancelledAt:          new Date(),
      });

      const result = await service.cancelSubscription('user-uuid', 'MOCK-SUB-456');

      expect(result.status).toBe('CANCELLED');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
