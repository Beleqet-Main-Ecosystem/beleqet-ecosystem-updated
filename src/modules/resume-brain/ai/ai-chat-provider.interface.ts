/**
 * AiChatProvider — provider-agnostic contract for a chat-completion LLM.
 *
 * `AIExtractorService` depends only on this interface (via the
 * {@link AI_CHAT_PROVIDER} DI token), never on a concrete SDK. That is what
 * lets us ship with Groq today and swap in a Gemini implementation tomorrow
 * without touching a single line of the extractor.
 *
 *   AIExtractorService → AI_CHAT_PROVIDER → GroqProvider   (today)
 *                                        → GeminiProvider  (later, same shape)
 */

export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiCompletionOptions {
  /** Upper bound on tokens generated. */
  maxTokens?: number;
  /** Sampling temperature. Extraction uses a low value for determinism. */
  temperature?: number;
  /** Ask the provider to guarantee a JSON object response when supported. */
  json?: boolean;
}

/**
 * Token accounting for a single completion. Drives per-user cost budgeting
 * ({@link AiBudgetService}) so we can cap spend on the paid AI provider.
 * Providers that do not report usage should return zeros — the budgeter then
 * counts requests only, never negative or NaN totals.
 */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A completed chat response: the assistant text plus its token accounting. */
export interface AiCompletion {
  content: string;
  usage: AiUsage;
}

export interface AiChatProvider {
  /** Human-readable provider name, used in logs and for `modelUsed` metadata. */
  readonly name: string;

  /**
   * Run a chat completion and return the assistant message text together with
   * its token usage. Implementations MUST throw {@link AiProviderError} on
   * failure so callers can map provider HTTP status codes to the right API
   * response, and MUST always populate {@link AiCompletion.usage} (zeros when
   * the provider does not report it).
   */
  complete(
    messages: AiChatMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletion>;
}

/**
 * Transport-level failure from an AI provider, carrying the upstream HTTP
 * status so the service layer can translate (e.g. 429 → Too Many Requests).
 */
export class AiProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Nest DI token for the active {@link AiChatProvider} implementation. */
export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER');