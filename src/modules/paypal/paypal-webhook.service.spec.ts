import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import axios from 'axios';
import { PaypalWebhookService } from './paypal-webhook.service';
import { PaypalAuthService } from './paypal-auth.service';
import { QUEUE_NAMES, PAYPAL_JOBS } from '../queues/queues.constants';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for PaypalWebhookService.
 * Focuses on the signature verification logic — the most security-critical
 * part of the PayPal integration (target: 80%+ coverage on this service).
 */
describe('PaypalWebhookService', () => {
  let service: PaypalWebhookService;
  let mockQueue: { add: jest.Mock };

  const mockAuthService = {
    getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
    getBaseUrl:     jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
  };

  const mockConfigService = {
    get: jest.fn((key: string): any => {
      const map: Record<string, string> = {
        PAYPAL_WEBHOOK_ID: 'WH-TEST-WEBHOOK-ID',
        NODE_ENV:          'test',
      };
      return map[key];
    }),
  };

  /** Builds a mock Express request with PayPal transmission headers */
  const buildRequest = (overrides: Record<string, string | undefined> = {}) =>
    ({
      rawBody: Buffer.from(JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' })),
      headers: {
        'paypal-transmission-id':   'test-transmission-id',
        'paypal-transmission-time': '2026-07-05T10:00:00Z',
        'paypal-cert-url':          'https://api.paypal.com/v1/notifications/certs/cert123',
        'paypal-transmission-sig':  'test-signature',
        'paypal-auth-algo':         'SHA256withRSA',
        ...overrides,
      },
    }) as any;

  const mockBody: Record<string, unknown> = {
    id:         'WH-evt-123',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource:   { id: 'capture-123', status: 'COMPLETED' },
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalWebhookService,
        { provide: PaypalAuthService,  useValue: mockAuthService },
        { provide: ConfigService,      useValue: mockConfigService },
        { provide: getQueueToken(QUEUE_NAMES.PAYPAL), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PaypalWebhookService>(PaypalWebhookService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── verifySignature ────────────────────────────────────────────────────────

  describe('verifySignature', () => {
    it('throws UnauthorizedException in test-like environments when signature fails', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'FAILURE' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a verified signature (SUCCESS from PayPal)', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).resolves.not.toThrow();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/notifications/verify-webhook-signature'),
        expect.objectContaining({
          webhook_id:        'WH-TEST-WEBHOOK-ID',
          transmission_id:   'test-transmission-id',
          webhook_event:     mockBody,
        }),
        expect.any(Object),
      );
    });

    it('does NOT throw only when explicit local dev bypass is enabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-TEST-WEBHOOK-ID';
        if (key === 'PAYPAL_WEBHOOK_SKIP_VERIFICATION') return 'true';
        return undefined;
      });

      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'FAILURE' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).resolves.not.toThrow();
    });

    it('throws UnauthorizedException in production when signature fails', async () => {
      // Override NODE_ENV to production
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-TEST-WEBHOOK-ID';
        return undefined;
      });

      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'FAILURE' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException in production when headers are missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-TEST-WEBHOOK-ID';
        return undefined;
      });

      // Request with no transmission headers
      const reqWithNoHeaders = buildRequest({
        'paypal-transmission-id':  undefined,
        'paypal-transmission-sig': undefined,
      });

      await expect(
        service.verifySignature(reqWithNoHeaders, mockBody),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws in development when PAYPAL_WEBHOOK_ID is missing unless bypass is enabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined; // PAYPAL_WEBHOOK_ID missing
      });

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handles PayPal verification API network errors gracefully only with explicit local bypass', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-TEST-WEBHOOK-ID';
        if (key === 'PAYPAL_WEBHOOK_SKIP_VERIFICATION') return 'true';
        return undefined;
      });

      mockedAxios.post         = jest.fn().mockRejectedValueOnce(new Error('Network Error'));
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).resolves.not.toThrow();
    });

    it('does not bypass verification in development unless the explicit flag is set', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-TEST-WEBHOOK-ID';
        return undefined;
      });

      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'FAILURE' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(
        service.verifySignature(buildRequest(), mockBody),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── verifyAndDispatch ──────────────────────────────────────────────────────

  describe('verifyAndDispatch', () => {
    it('dispatches PAYMENT.CAPTURE.COMPLETED to PROCESS_WEBHOOK queue job', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.verifyAndDispatch(buildRequest(), mockBody);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PAYPAL_JOBS.PROCESS_WEBHOOK,
        expect.objectContaining({ eventType: 'PAYMENT.CAPTURE.COMPLETED' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('dispatches BILLING.SUBSCRIPTION.ACTIVATED to SYNC_SUBSCRIPTION queue job', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const subBody = {
        ...mockBody,
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource:   { id: 'I-sub-123', status: 'ACTIVE' },
      };

      await service.verifyAndDispatch(buildRequest(), subBody);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PAYPAL_JOBS.SYNC_SUBSCRIPTION,
        expect.objectContaining({ eventType: 'BILLING.SUBSCRIPTION.ACTIVATED' }),
        expect.any(Object),
      );
    });

    it('dispatches CUSTOMER.DISPUTE.CREATED to SYNC_DISPUTE queue job', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const disputeBody = {
        ...mockBody,
        event_type: 'CUSTOMER.DISPUTE.CREATED',
        resource:   { dispute_id: 'PP-D-123', reason: 'ITEM_NOT_RECEIVED', status: 'OPEN', create_time: '2026-07-05T10:00:00Z' },
      };

      await service.verifyAndDispatch(buildRequest(), disputeBody);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PAYPAL_JOBS.SYNC_DISPUTE,
        expect.objectContaining({ eventType: 'CUSTOMER.DISPUTE.CREATED' }),
        expect.any(Object),
      );
    });

    it('silently ignores unknown event types without throwing', async () => {
      mockedAxios.post         = jest.fn().mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const unknownBody = { ...mockBody, event_type: 'SOME.UNKNOWN.EVENT' };

      await expect(
        service.verifyAndDispatch(buildRequest(), unknownBody),
      ).resolves.not.toThrow();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});
