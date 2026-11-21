import { describe, expect, it } from '@jest/globals';
import { AxiosError, type AxiosResponse } from 'axios';
import { ApiError, OFFLINE, errorText, toApiError } from '../api-error';

function failed(status: number | null, data?: unknown): AxiosError {
  const response = status === null ? undefined : ({ status, data, statusText: '', headers: {}, config: {} } as AxiosResponse);
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
}

// Returns the key, so the tests see which message was chosen.
const t = (key: string) => `<${key}>`;

describe('toApiError', () => {
  it('reads the status, error code and message the API sends', () => {
    const error = toApiError(failed(409, { statusCode: 409, errorCode: 'ERR_TAKEN', message: 'That email is taken.' }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('ERR_TAKEN');
    expect(error.serverMessage).toBe('That email is taken.');
  });

  it('joins a list of validation messages', () => {
    expect(toApiError(failed(400, { message: ['email is invalid', 'password is too short'] })).message)
      .toBe('email is invalid; password is too short');
  });

  it('treats a request that never got an answer as offline', () => {
    expect(toApiError(failed(null)).status).toBe(OFFLINE);
  });

  it('keeps an ApiError as it is, and wraps anything else', () => {
    const own = new ApiError(404);
    expect(toApiError(own)).toBe(own);
    expect(toApiError(new Error('boom')).status).toBe(-1);
    expect(own.serverMessage).toBeUndefined();
  });
});

describe('errorText', () => {
  it('uses the app’s own words for what the user can fix', () => {
    expect(errorText(failed(null), t)).toBe('<errors.offline>');
    expect(errorText(failed(403, { errorCode: 'ERR_EMAIL_NOT_VERIFIED', message: 'x' }), t)).toBe('<errors.emailUnverified>');
    expect(errorText(failed(403, { errorCode: 'ERR_EMAIL_REQUIRED', message: 'x' }), t)).toBe('<errors.emailMissing>');
    expect(errorText(failed(401, { message: 'Unauthorized' }), t)).toBe('<errors.signedOut>');
    expect(errorText(failed(429, { message: 'Slow down' }), t)).toBe('<errors.tooMany>');
  });

  it('shows the server’s explanation for other refusals, and a general message for server faults', () => {
    expect(errorText(failed(400, { message: 'The deadline has passed.' }), t)).toBe('The deadline has passed.');
    expect(errorText(failed(500, { message: 'Internal server error' }), t)).toBe('<m.error.generic>');
    expect(errorText(failed(500), t, 'm.jobs.loadFailed')).toBe('<m.jobs.loadFailed>');
  });
});
