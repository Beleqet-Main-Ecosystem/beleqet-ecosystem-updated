import { ApiError, apiError, errorText } from '../api-error';

const t = (key: string) => `t:${key}`;

describe('errorText', () => {
  it('asks to confirm the email when the server says it is not verified', () => {
    const error = new ApiError(403, 'ERR_EMAIL_NOT_VERIFIED', 'Please confirm your email address first.');
    expect(errorText(error, t, 'post.failed')).toBe('t:errors.emailUnverified');
  });

  it('sends a Telegram sign-up without an email to the bot to add one', () => {
    const error = new ApiError(403, 'ERR_EMAIL_REQUIRED', 'Add and confirm your email address first.');
    expect(errorText(error, t, 'post.failed')).toBe('t:errors.emailMissing');
  });

  it('shows the server explanation for any other refusal', () => {
    const error = new ApiError(400, 'ERR_BAD_REQUEST', 'Milestones would add up to more than the contract amount.');
    expect(errorText(error, t, 'post.failed')).toBe('Milestones would add up to more than the contract amount.');
  });

  it('has its own words for a lapsed session, rate limits and no connection', () => {
    expect(errorText(new ApiError(401, 'ERR_UNAUTHORIZED', 'Unauthorized'), t, 'x')).toBe('t:errors.signedOut');
    expect(errorText(new ApiError(429, 'ERR_RATE_LIMIT_EXCEEDED', 'Slow down'), t, 'x')).toBe('t:errors.tooMany');
    expect(errorText(new TypeError('Failed to fetch'), t, 'x')).toBe('t:errors.offline');
  });

  it('falls back to "try again" for server faults and errors without a reason', () => {
    expect(errorText(new ApiError(500, 'ERR_INTERNAL', 'An unexpected error occurred.'), t, 'post.failed')).toBe('t:post.failed');
    expect(errorText(new ApiError(403), t, 'post.failed')).toBe('t:post.failed');
    expect(errorText(new Error('boom'), t, 'post.failed')).toBe('t:post.failed');
    expect(errorText(new TypeError("Cannot read properties of undefined"), t, 'post.failed')).toBe('t:post.failed');
  });
});

// jsdom has no Response; apiError only reads status and json().
const reply = (status: number, body: string) =>
  ({ status, json: async () => JSON.parse(body) }) as unknown as Response;

describe('apiError', () => {
  it('reads the status, code and message from the error body', async () => {
    const response = reply(409, JSON.stringify({ statusCode: 409, errorCode: 'ERR_CONFLICT', message: ['a', 'b'] }));
    const error = await apiError(response);
    expect([error.status, error.code, error.serverMessage]).toEqual([409, 'ERR_CONFLICT', 'a; b']);
  });

  it('copes with a body that is not JSON', async () => {
    const error = await apiError(reply(502, '<html>Bad gateway</html>'));
    expect([error.status, error.code, error.serverMessage]).toEqual([502, undefined, undefined]);
  });
});
