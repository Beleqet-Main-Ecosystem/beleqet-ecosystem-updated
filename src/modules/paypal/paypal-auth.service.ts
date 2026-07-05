import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * @class PaypalAuthService
 * @module PayPal
 * @description Manages PayPal OAuth 2.0 client-credentials token lifecycle.
 *
 * **Security Model**:
 * - Credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) are loaded exclusively
 *   from environment variables and are never logged or persisted.
 * - The access token is cached **in-memory only** and is never written to the database,
 *   Redis, or any external storage medium.
 * - Tokens are proactively refreshed 5 minutes before expiry so downstream services
 *   always receive a valid bearer string without extra round-trips.
 * - Mock mode returns a static sentinel token to enable fully offline demos.
 *
 * **OAuth 2.0 Grant Type**: `client_credentials` (machine-to-machine; no user consent needed).
 *
 * @see {@link https://developer.paypal.com/api/rest/authentication/} PayPal OAuth 2.0 docs
 *
 * @example
 * ```ts
 * // Inject in any service:
 * constructor(private readonly auth: PaypalAuthService) {}
 *
 * // Use in an API call:
 * const token = await this.auth.getAccessToken();
 * const baseUrl = this.auth.getBaseUrl();
 * await axios.post(`${baseUrl}/v2/...`, body, {
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 * ```
 */
@Injectable()
export class PaypalAuthService {
  private readonly logger = new Logger(PaypalAuthService.name);

  /** Cached bearer token string — never persisted outside this process */
  private cachedToken: string | null = null;

  /** Unix timestamp (ms) when the cached token expires */
  private tokenExpiresAt = 0;

  /**
   * Buffer before expiry to force a proactive refresh.
   * 5 minutes ensures downstream requests never hit an expired token.
   */
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1_000;

  constructor(private readonly config: ConfigService) {}

  /**
   * Returns a valid PayPal OAuth 2.0 access token.
   *
   * The method checks the in-memory cache first. If the token is missing,
   * expired, or within the 5-minute refresh buffer, a new token is fetched
   * from PayPal's `/v1/oauth2/token` endpoint.
   *
   * In `mock` mode, a static sentinel string is returned immediately
   * without any network call or credential validation.
   *
   * @returns A valid PayPal access token string
   * @throws {UnauthorizedException} If PayPal rejects the client credentials
   *
   * @example
   * ```ts
   * const token = await this.auth.getAccessToken();
   * // token → 'A21AAF...' (real mode) or 'mock-access-token-12345' (mock mode)
   * ```
   */
  async getAccessToken(): Promise<string> {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    if (mode === 'mock') {
      return 'mock-access-token-12345';
    }

    if (
      this.cachedToken &&
      Date.now() < this.tokenExpiresAt - this.REFRESH_BUFFER_MS
    ) {
      return this.cachedToken;
    }

    return this.refreshToken();
  }

  /**
   * Forces a new token fetch from the PayPal OAuth 2.0 endpoint.
   * Updates the in-memory cache on success.
   *
   * This method is private because external callers should use {@link getAccessToken},
   * which handles cache-hit logic before deciding whether to refresh.
   *
   * @returns Fresh access token string
   * @throws {UnauthorizedException} On invalid credentials or network failure
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

      // Log refresh event WITHOUT the token value — only expiry timing
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
   * Use this in all downstream services instead of hardcoding URLs.
   *
   * | Mode      | Base URL                            |
   * |-----------|-------------------------------------|
   * | `live`    | `https://api-m.paypal.com`          |
   * | `sandbox` | `https://api-m.sandbox.paypal.com`  |
   * | `mock`    | `https://api-m.sandbox.paypal.com`  |
   *
   * @returns PayPal REST API base URL string (without trailing slash)
   *
   * @example
   * ```ts
   * const baseUrl = this.auth.getBaseUrl();
   * // baseUrl → 'https://api-m.sandbox.paypal.com' (sandbox/mock)
   * // baseUrl → 'https://api-m.paypal.com' (live)
   * ```
   */
  getBaseUrl(): string {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    return mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  /**
   * Invalidates the in-memory token cache, forcing a fresh OAuth 2.0 exchange
   * on the next call to {@link getAccessToken}.
   *
   * Call this after a `401 Unauthorized` response from any downstream PayPal
   * API to trigger an immediate re-authentication cycle.
   *
   * @example
   * ```ts
   * // After receiving a 401 from the Orders API:
   * this.auth.invalidateToken();
   * const freshToken = await this.auth.getAccessToken(); // fetches a new token
   * ```
   */
  invalidateToken(): void {
    this.cachedToken    = null;
    this.tokenExpiresAt = 0;
    this.logger.debug('PayPal token cache invalidated — will re-authenticate on next request');
  }

  /**
   * Returns the absolute UTC timestamp at which the current cached token expires.
   * Returns `null` if no token has been cached yet (i.e. no call has been made).
   *
   * Useful for monitoring dashboards and health-check endpoints to surface
   * token expiry state without accessing the token itself.
   *
   * @returns Token expiry as a `Date` object, or `null` if not yet fetched
   *
   * @example
   * ```ts
   * const expiry = this.auth.getTokenExpiresAt();
   * // expiry → Date('2026-07-06T07:30:00.000Z')
   * // expiry → null (if getAccessToken() has never been called)
   * ```
   */
  getTokenExpiresAt(): Date | null {
    return this.tokenExpiresAt > 0 ? new Date(this.tokenExpiresAt) : null;
  }
}
