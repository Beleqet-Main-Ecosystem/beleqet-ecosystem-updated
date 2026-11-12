/**
 * A failed API call, with what the server said about it. The API answers every error with
 * `{ statusCode, errorCode, message }`; 4xx messages are written for the user.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
  ) {
    super(message || `Request failed: ${status}`);
  }

  /** The server's own explanation, when there is one. */
  get serverMessage(): string | undefined {
    return this.message.startsWith('Request failed:') ? undefined : this.message;
  }
}

/** Reads the error body of a failed response into an ApiError. */
export async function apiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null) as { errorCode?: unknown; message?: unknown } | null;
  const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
  return new ApiError(
    response.status,
    typeof body?.errorCode === 'string' ? body.errorCode : undefined,
    typeof message === 'string' ? message : undefined,
  );
}

/**
 * What to tell the user about a failed action. Cases the user can fix get their own words; any other
 * refusal shows the server's explanation; only a server fault falls back to `fallbackKey` ("Try again").
 */
export function errorText(error: unknown, t: (key: string) => string, fallbackKey: string): string {
  // fetch itself throws a TypeError when the request never reached the server (the wording differs by browser).
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return t('errors.offline');
  if (!(error instanceof ApiError)) return t(fallbackKey);
  if (error.code === 'ERR_EMAIL_NOT_VERIFIED') return t('errors.emailUnverified');
  // A Telegram sign-up has no email yet: the bot is where it adds one.
  if (error.code === 'ERR_EMAIL_REQUIRED') return t('errors.emailMissing');
  if (error.status === 401) return t('errors.signedOut');
  if (error.status === 429) return t('errors.tooMany');
  if (error.status >= 400 && error.status < 500 && error.serverMessage) return error.serverMessage;
  return t(fallbackKey);
}
