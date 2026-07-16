/**
 * GroqProvider unit tests (Phase 10 — production polish).
 *
 * Focus on the transport-boundary behaviour the API depends on:
 *   - missing key fails fast as 503 (not a confusing upstream 401),
 *   - a request timeout / connection drop maps to 503,
 *   - an upstream 429 is preserved so the extractor can surface 429,
 *   - a happy-path completion returns the raw assistant text,
 *   - the client is constructed with a bounded timeout + retries.
 *
 * The `openai` SDK is mocked at the network edge (`chat.completions.create`)
 * while the REAL error classes are kept so `instanceof` checks in the provider
 * exercise the same code paths production hits.
 */
const createMock = jest.fn();
const capturedClientOptions: Array<Record<string, unknown>> = [];

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  // A stand-in constructor that records its options and exposes the mocked
  // chat.completions.create, while re-exporting the real error classes so
  // `OpenAI.APIError` / `APIConnectionTimeoutError` instanceof checks work.
  class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(options: Record<string, unknown>) {
      capturedClientOptions.push(options);
    }
    static APIError = actual.APIError;
    static APIConnectionError = actual.APIConnectionError;
    static APIConnectionTimeoutError = actual.APIConnectionTimeoutError;
  }
  return { __esModule: true, ...actual, default: MockOpenAI, OpenAI: MockOpenAI };
});

import OpenAI from 'openai';
import { GroqProvider } from './groq.provider';
import { AiProviderError } from './ai-chat-provider.interface';

/** Minimal ConfigService stub driven by a plain map. */
function configWith(values: Record<string, unknown>) {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (values[key] as T) ?? (fallback as T),
  } as any;
}

const OK_MESSAGES = [
  { role: 'system' as const, content: 'be a parser' },
  { role: 'user' as const, content: 'resume text' },
];

describe('GroqProvider', () => {
  beforeEach(() => {
    createMock.mockReset();
    capturedClientOptions.length = 0;
  });

  it('constructs the client with a bounded timeout and retry count', () => {
    new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    const opts = capturedClientOptions[0];
    expect(opts.timeout).toBe(20_000);
    expect(opts.maxRetries).toBe(2);
    expect(opts.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('honours GROQ_TIMEOUT_MS / GROQ_MAX_RETRIES / GROQ_BASE_URL overrides', () => {
    new GroqProvider(
      configWith({
        GROQ_API_KEY: 'gsk_test',
        GROQ_TIMEOUT_MS: 5_000,
        GROQ_MAX_RETRIES: 0,
        GROQ_BASE_URL: 'https://api.x.ai/v1',
      }),
    );
    const opts = capturedClientOptions[0];
    expect(opts.timeout).toBe(5_000);
    expect(opts.maxRetries).toBe(0);
    expect(opts.baseURL).toBe('https://api.x.ai/v1');
  });

  it('fails fast with 503 when GROQ_API_KEY is not configured', async () => {
    const provider = new GroqProvider(configWith({}));
    await expect(provider.complete(OK_MESSAGES)).rejects.toMatchObject({
      status: 503,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns the trimmed assistant text plus token usage on success', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '  {"firstName":"Abebe"}  ' } }],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    });
    const provider = new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    await expect(
      provider.complete(OK_MESSAGES, { json: true }),
    ).resolves.toEqual({
      content: '{"firstName":"Abebe"}',
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
    });
  });

  it('defaults usage to zero when the provider omits it', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"firstName":"Abebe"}' } }],
    });
    const provider = new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    const result = await provider.complete(OK_MESSAGES);
    expect(result.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('throws 502 when the model returns an empty message', async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });
    const provider = new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    await expect(provider.complete(OK_MESSAGES)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('maps a request timeout to a 503 AiProviderError', async () => {
    createMock.mockRejectedValueOnce(
      new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }),
    );
    const provider = new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    const err = await provider.complete(OK_MESSAGES).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.status).toBe(503);
  });

  it('preserves an upstream 429 so the extractor can surface Too Many Requests', async () => {
    createMock.mockRejectedValueOnce(
      new OpenAI.APIError(429, { error: 'rate limited' }, 'rate limited', undefined),
    );
    const provider = new GroqProvider(configWith({ GROQ_API_KEY: 'gsk_test' }));
    const err = await provider.complete(OK_MESSAGES).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.status).toBe(429);
  });
});
