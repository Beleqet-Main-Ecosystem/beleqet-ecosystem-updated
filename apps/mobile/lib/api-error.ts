import { isAxiosError } from 'axios';

/**
 * A failed API call, with what the server said about it. Same shape and rules as the website's
 * lib/api-error.ts: the API answers every error with `{ statusCode, errorCode, message }`, and 4xx
 * messages are written for the user.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    /** The whole error body, for fields like requiresStepUp. */
    public body?: Record<string, unknown>,
  ) {
    super(message || `Request failed: ${status}`);
  }

  /** The server's own explanation, when there is one. */
  get serverMessage(): string | undefined {
    return this.message.startsWith('Request failed:') ? undefined : this.message;
  }
}

/** Status 0: the request never reached the server (no connection, timeout). */
export const OFFLINE = 0;

/** Turns whatever axios threw into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) return new ApiError(OFFLINE);
    const body = error.response.data as { errorCode?: unknown; message?: unknown } | undefined;
    const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    return new ApiError(
      error.response.status,
      typeof body?.errorCode === 'string' ? body.errorCode : undefined,
      typeof message === 'string' ? message : undefined,
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : undefined,
    );
  }
  return new ApiError(-1, undefined, error instanceof Error ? error.message : undefined);
}

/**
 * What to tell the user about a failed action. Cases the user can fix get their own words; any
 * other refusal shows the server's explanation; only a server fault falls back to `fallbackKey`.
 */
export function errorText(error: unknown, t: (key: string) => string, fallbackKey = 'm.error.generic'): string {
  const failure = toApiError(error);
  if (failure.status === OFFLINE) return t('errors.offline');
  if (failure.code === 'ERR_EMAIL_NOT_VERIFIED') return t('errors.emailUnverified');
  // A Telegram sign-up has no email yet: the bot is where it adds one. Same as the website.
  if (failure.code === 'ERR_EMAIL_REQUIRED') return t('errors.emailMissing');
  if (failure.status === 401) return t('errors.signedOut');
  if (failure.status === 429) return t('errors.tooMany');
  if (failure.status >= 400 && failure.status < 500 && failure.serverMessage) return failure.serverMessage;
  return t(fallbackKey);
}
