import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Manages PayPal OAuth 2.0 client-credentials tokens.
 *
 * Tokens are valid for 32400 seconds (9 hours). This service caches the
 * token in memory and silently refreshes it 5 minutes before expiry so
 * that all downstream services always receive a valid bearer token without
 * any extra round-trips.
 *
 * @example
 * ```ts
 * const token = await this.paypalAuthService.getAccessToken();
 * ```
 */
@Injectable()
export class PaypalAuthService {
  private readonly logger = new Logger(PaypalAuthService.name);

  /** Cached bearer token string */
  private cachedToken: string | null = null;

  /** Unix timestamp (ms) when the cached token expires */
  private tokenExpiresAt = 0;

  /** Buffer before expiry to force a proactive refresh (5 minutes) */
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1_000;

  constructor(private readonly config: ConfigService) {}

  /**
   * Returns a valid PayPal OAuth access token, refreshing from the API
   * if the cached token is missing or about to expire.
   *
   * @returns A valid PayPal access token string
   * @throws UnauthorizedException if PayPal rejects the client credentials
   */
  async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      Date.now() < this.tokenExpiresAt - this.REFRESH_BUFFER_MS
    ) {
      return this.cachedToken;
    }

    return this.refreshToken();
  }

  /**
   * Forces a new token fetch from the PayPal OAuth endpoint.
   * Updates the in-memory cache on success.
   *
   * @returns Fresh access token
   * @throws UnauthorizedException on invalid credentials or network failure
   */
  private async refreshToken(): Promise<string> {
    const clientId     = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    const mode         = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    const baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    try {
      const response = await axios.post<{
        access_token: string;
        expires_in: number;
      }>(
        `${baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: clientId!, password: clientSecret! },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const { access_token, expires_in } = response.data;
      this.cachedToken    = access_token;
      this.tokenExpiresAt = Date.now() + expires_in * 1_000;

      this.logger.debug(
        `PayPal token refreshed. Expires in ${expires_in}s (${mode} mode)`,
      );

      return access_token;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `${err.response?.status} — ${JSON.stringify(err.response?.data)}`
        : String(err);

      this.logger.error(`Failed to fetch PayPal access token: ${msg}`);
      throw new UnauthorizedException(
        'Unable to authenticate with PayPal. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      );
    }
  }

  /**
   * Returns the PayPal REST API base URL based on the configured mode.
   * Use this in all downstream services instead of hardcoding the URL.
   *
   * @returns 'https://api-m.paypal.com' for live or sandbox equivalent
   */
  getBaseUrl(): string {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    return mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }
}
