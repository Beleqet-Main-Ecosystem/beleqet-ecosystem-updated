import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { PaypalAuthService } from './paypal-auth.service';

// Mock axios at the module level
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for {@link PaypalAuthService}.
 *
 * Verifies:
 * - Token fetching from PayPal OAuth endpoint
 * - In-memory token caching and cache hits
 * - Proactive 5-minute refresh before expiry
 * - `UnauthorizedException` on invalid credentials
 * - Mock mode bypass (no network call)
 * - `invalidateToken()` resets the cache
 * - `getTokenExpiresAt()` returns correct Date or null
 * - `getBaseUrl()` returns correct URL per mode
 */
describe('PaypalAuthService', () => {
  let service: PaypalAuthService;
  let configService: jest.Mocked<ConfigService>;

  /** Standard sandbox mock token returned by PayPal's /v1/oauth2/token */
  const mockTokenResponse = {
    data: {
      access_token: 'A21AAFJ...-mock-token',
      expires_in:   32400, // 9 hours
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              const map: Record<string, string> = {
                PAYPAL_CLIENT_ID:     'test-client-id',
                PAYPAL_CLIENT_SECRET: 'test-client-secret',
                PAYPAL_MODE:          'sandbox',
              };
              return map[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service       = module.get<PaypalAuthService>(PaypalAuthService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset in-memory token cache between tests to prevent bleeding
    (service as any).cachedToken    = null;
    (service as any).tokenExpiresAt = 0;
  });

  // ── getAccessToken ──────────────────────────────────────────────────────────

  describe('getAccessToken', () => {
    it('fetches a new token when no cached token exists', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const token = await service.getAccessToken();

      expect(token).toBe('A21AAFJ...-mock-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        'grant_type=client_credentials',
        expect.objectContaining({
          auth: { username: 'test-client-id', password: 'test-client-secret' },
        }),
      );
    });

    it('returns cached token on second call without hitting PayPal API again', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      // First call — fetches from PayPal
      await service.getAccessToken();
      // Second call — should use cached value
      const token = await service.getAccessToken();

      expect(token).toBe('A21AAFJ...-mock-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('refreshes the token when within the 5-minute buffer window', async () => {
      // Only ONE axios.post call will happen — it should return the fresh token
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { access_token: 'refreshed-token-xyz', expires_in: 32400 },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      // Manually set a token that expires in 4 minutes (inside the 5-min buffer)
      // Condition: Date.now() < (Date.now() + 4min) - 5min → false → triggers refresh
      (service as any).cachedToken    = 'old-expiring-token';
      (service as any).tokenExpiresAt = Date.now() + 4 * 60 * 1_000;

      const token = await service.getAccessToken();

      expect(token).toBe('refreshed-token-xyz');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('returns mock sentinel token in mock mode without any API call', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PAYPAL_MODE') return 'mock';
        return undefined;
      });

      const token = await service.getAccessToken();

      expect(token).toBe('mock-access-token-12345');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when PayPal returns 401 invalid_client', async () => {
      const axiosError = {
        response:     { status: 401, data: { error: 'invalid_client' } },
        isAxiosError: true,
      };
      mockedAxios.post                       = jest.fn().mockRejectedValueOnce(axiosError);
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(service.getAccessToken()).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on network failure (non-axios error)', async () => {
      mockedAxios.post                       = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(service.getAccessToken()).rejects.toThrow(UnauthorizedException);
    });

    it('uses the live PayPal endpoint when PAYPAL_MODE is live', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const liveMap: Record<string, string> = {
          PAYPAL_CLIENT_ID:     'live-client-id',
          PAYPAL_CLIENT_SECRET: 'live-client-secret',
          PAYPAL_MODE:          'live',
        };
        return liveMap[key];
      });

      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.getAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-m.paypal.com/v1/oauth2/token',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ── invalidateToken ─────────────────────────────────────────────────────────

  describe('invalidateToken', () => {
    it('clears the cached token so the next call fetches a fresh one', async () => {
      // Pre-seed a valid cache
      (service as any).cachedToken    = 'some-valid-token';
      (service as any).tokenExpiresAt = Date.now() + 60 * 60 * 1_000; // 1 hour

      service.invalidateToken();

      // Cache should be cleared
      expect((service as any).cachedToken).toBeNull();
      expect((service as any).tokenExpiresAt).toBe(0);
    });

    it('forces a network call after invalidation', async () => {
      (service as any).cachedToken    = 'pre-cached-token';
      (service as any).tokenExpiresAt = Date.now() + 60 * 60 * 1_000;

      service.invalidateToken();

      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      const newToken = await service.getAccessToken();

      expect(newToken).toBe('A21AAFJ...-mock-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  // ── getTokenExpiresAt ───────────────────────────────────────────────────────

  describe('getTokenExpiresAt', () => {
    it('returns null before any token has been fetched', () => {
      expect(service.getTokenExpiresAt()).toBeNull();
    });

    it('returns a Date object after a token has been fetched', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.getAccessToken();

      const expiresAt = service.getTokenExpiresAt();
      expect(expiresAt).toBeInstanceOf(Date);
      // Should be approximately 9 hours from now (32400 seconds)
      expect(expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns null after invalidateToken() is called', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockTokenResponse);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await service.getAccessToken();
      service.invalidateToken();

      expect(service.getTokenExpiresAt()).toBeNull();
    });
  });

  // ── getBaseUrl ──────────────────────────────────────────────────────────────

  describe('getBaseUrl', () => {
    it('returns sandbox URL when PAYPAL_MODE is sandbox', () => {
      const url = service.getBaseUrl();
      expect(url).toBe('https://api-m.sandbox.paypal.com');
    });

    it('returns live URL when PAYPAL_MODE is live', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PAYPAL_MODE') return 'live';
        return undefined;
      });

      const url = service.getBaseUrl();
      expect(url).toBe('https://api-m.paypal.com');
    });

    it('returns sandbox URL when PAYPAL_MODE is mock (simulator uses sandbox base)', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PAYPAL_MODE') return 'mock';
        return undefined;
      });

      const url = service.getBaseUrl();
      expect(url).toBe('https://api-m.sandbox.paypal.com');
    });
  });
});
