import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { PaypalAuthService } from './paypal-auth.service';

// Mock axios at the module level
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Unit tests for PaypalAuthService.
 * Verifies token caching, proactive refresh, and error handling.
 */
describe('PaypalAuthService', () => {
  let service: PaypalAuthService;
  let configService: jest.Mocked<ConfigService>;

  const mockToken = {
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
    // Reset cached token between tests
    (service as any).cachedToken    = null;
    (service as any).tokenExpiresAt = 0;
  });

  describe('getAccessToken', () => {
    it('fetches a new token when no cached token exists', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockToken);
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

    it('returns cached token when it has not expired', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce(mockToken);
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      // First call — fetches from PayPal
      await service.getAccessToken();
      // Second call — should return cached token
      const token = await service.getAccessToken();

      expect(token).toBe('A21AAFJ...-mock-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Only one real call
    });

    it('refreshes the token when it is within the 5-minute buffer window', async () => {
      mockedAxios.post = jest.fn()
        .mockResolvedValueOnce(mockToken)
        .mockResolvedValueOnce({ data: { ...mockToken.data, access_token: 'new-refreshed-token' } });
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      // Simulate token that expires in 4 minutes (within the 5-minute buffer)
      (service as any).cachedToken    = 'old-token';
      (service as any).tokenExpiresAt = Date.now() + 4 * 60 * 1_000;

      const token = await service.getAccessToken();

      expect(token).toBe('new-refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException when PayPal rejects credentials', async () => {
      const axiosError = {
        response:  { status: 401, data: { error: 'invalid_client' } },
        isAxiosError: true,
      };
      mockedAxios.post        = jest.fn().mockRejectedValueOnce(axiosError);
      jest.mocked(axios.isAxiosError).mockReturnValue(true);

      await expect(service.getAccessToken()).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on network failure', async () => {
      mockedAxios.post        = jest.fn().mockRejectedValueOnce(new Error('Network Error'));
      jest.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(service.getAccessToken()).rejects.toThrow(UnauthorizedException);
    });
  });

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
  });
});
