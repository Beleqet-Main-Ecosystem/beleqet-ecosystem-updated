import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiChatMessage,
  AiChatProvider,
  AiCompletion,
  AiCompletionOptions,
  AiProviderError,
} from './ai-chat-provider.interface';

/**
 * GroqProvider — {@link AiChatProvider} backed by Groq.
 *
 * Groq exposes an OpenAI-compatible REST API, so we reuse the `openai` SDK
 * that already ships with this repo (see screening.processor.ts) rather than
 * pulling in a new dependency — we just repoint its `baseURL`. It also reuses
 * the exact same `GROQ_API_KEY` / `GROQ_MODEL` env vars the Next.js frontend
 * already uses (beleqet-jobs-nextjs/lib/groq.ts), so a single config drives
 * both ends.
 *
 * Default model: `llama-3.1-8b-instant` (matches the frontend default).
 */
/**
 * Fail an AI request that hasn't completed within this many ms. Kept short for
 * a user-facing upload flow — a resume extraction that takes longer than this
 * is almost certainly a stuck upstream, and a 20s spinner already hurts UX.
 * Override per environment with `GROQ_TIMEOUT_MS`.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
/** SDK-level retries for transient network / 5xx / 429 errors. */
const DEFAULT_MAX_RETRIES = 2;

@Injectable()
export class GroqProvider implements AiChatProvider {
  readonly name = 'groq';

  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('GROQ_MODEL', 'llama-3.1-8b-instant');
    this.client = new OpenAI({
      apiKey: this.config.get<string>('GROQ_API_KEY') ?? '',
      baseURL: this.config.get<string>(
        'GROQ_BASE_URL',
        'https://api.groq.com/openai/v1',
      ),
      // Bound every request so a hung upstream can never block the API
      // indefinitely; the SDK aborts and surfaces an APIConnectionTimeoutError
      // which we map to 503. Retries cover transient network/5xx/429 blips.
      timeout: this.config.get<number>(
        'GROQ_TIMEOUT_MS',
        DEFAULT_REQUEST_TIMEOUT_MS,
      ),
      maxRetries: this.config.get<number>(
        'GROQ_MAX_RETRIES',
        DEFAULT_MAX_RETRIES,
      ),
    });
  }

  async complete(
    messages: AiChatMessage[],
    options: AiCompletionOptions = {},
  ): Promise<AiCompletion> {
    if (!this.config.get<string>('GROQ_API_KEY')) {
      // Fail fast with a 503-mapped error rather than a confusing 401 from Groq.
      throw new AiProviderError(503, 'GROQ_API_KEY is not configured');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 1500,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new AiProviderError(502, 'Groq returned an empty response');
      }

      // Surface token usage so AiBudgetService can meter per-user spend. Groq is
      // OpenAI-wire-compatible and returns `usage`; default to 0 if it is ever
      // absent so metering degrades to request-counting rather than crashing.
      const usage = completion.usage;
      return {
        content,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
      };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;

      // A request that exceeded `timeout` (or ran out of retries on a network
      // fault) surfaces as an APIConnectionTimeoutError / APIConnectionError
      // with no HTTP status — treat those as a 503 (service unavailable).
      if (
        err instanceof OpenAI.APIConnectionTimeoutError ||
        err instanceof OpenAI.APIConnectionError
      ) {
        this.logger.warn(`Groq request timed out / unreachable: ${(err as Error).message}`);
        throw new AiProviderError(503, 'Groq request timed out');
      }

      // Translate an OpenAI-SDK APIError (Groq is wire-compatible) into our
      // transport-agnostic error, preserving the upstream status (e.g. 429).
      const status =
        err instanceof OpenAI.APIError && typeof err.status === 'number'
          ? err.status
          : 503;
      this.logger.warn(`Groq request failed (${status}): ${(err as Error).message}`);
      throw new AiProviderError(status, 'Groq request failed');
    }
  }
}
