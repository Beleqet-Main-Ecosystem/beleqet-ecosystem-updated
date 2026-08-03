import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Returns an OpenAI client only when a real API key is configured.
 * Placeholder values (sk-..., dummy_*) are treated as unavailable.
 */
export function resolveOpenAiClient(config: ConfigService): OpenAI | null {
  const apiKey = config.get<string>('OPENAI_API_KEY')?.trim();
  if (!apiKey) return null;
  if (apiKey === 'sk-...' || apiKey.startsWith('dummy')) return null;
  return new OpenAI({ apiKey });
}
