import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { FaqKnowledgeEntry } from '@prisma/client';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { resolveOpenAiClient } from './openai-config';

export interface StreamAnswerParams {
  userQuestion: string;
  contextEntries: FaqKnowledgeEntry[];
  locale: string;
  preferredCurrency: string;
  currencyContext?: string;
  onToken: (token: string) => void;
}

/**
 * Integrates with OpenAI for embedding-backed RAG and streaming chat completions.
 */
@Injectable()
export class AiStreamService {
  private readonly logger = new Logger(AiStreamService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly config: ConfigService,
    private readonly knowledgeRetrieval: KnowledgeRetrievalService,
  ) {
    this.openai = resolveOpenAiClient(this.config);
  }

  /** Whether the OpenAI client is configured. */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Build a grounded system prompt for the FAQ assistant.
   * @param locale - User locale
   * @param preferredCurrency - Display currency
   */
  buildSystemPrompt(locale: string, preferredCurrency: string): string {
    const language = locale === 'am' ? 'Amharic' : 'English';
    return [
      'You are the Beleqet FAQ Assistant for a global freelance and jobs platform.',
      `Always respond in ${language}.`,
      `When mentioning money, prefer ${preferredCurrency} where applicable.`,
      'Answer ONLY using the provided knowledge base context.',
      'If the context does not contain the answer, politely say you cannot help and suggest contacting support.',
      'Do not invent policies, fees, or timelines.',
      'Keep answers concise, friendly, and actionable.',
    ].join(' ');
  }

  /**
   * Format knowledge entries into RAG context for the LLM prompt.
   * @param entries - Retrieved FAQ entries
   * @param locale - User locale
   * @param currencyContext - Optional formatted currency hints
   */
  buildContextBlock(
    entries: FaqKnowledgeEntry[],
    locale: string,
    currencyContext?: string,
  ): string {
    const blocks = entries.map((entry) => {
      const { question, answer } = this.knowledgeRetrieval.localizeEntry(entry, locale);
      return `Q: ${question}\nA: ${answer}`;
    });
    const parts = blocks.join('\n\n');
    return currencyContext ? `${parts}\n\n${currencyContext}` : parts;
  }

  /**
   * Stream an AI-generated answer grounded on retrieved FAQ context.
   * Falls back to the best KB answer when OpenAI is unavailable.
   * @param params - Streaming parameters including token callback
   * @returns Full assembled assistant response
   */
  async streamAnswer(params: StreamAnswerParams): Promise<string> {
    const { userQuestion, contextEntries, locale, preferredCurrency, currencyContext, onToken } =
      params;

    if (!this.openai || contextEntries.length === 0) {
      return this.streamFallbackAnswer(contextEntries, locale, onToken);
    }

    const systemPrompt = this.buildSystemPrompt(locale, preferredCurrency);
    const context = this.buildContextBlock(contextEntries, locale, currencyContext);

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        stream: true,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Knowledge Base Context:\n${context}\n\nUser Question: ${userQuestion}`,
          },
        ],
      });

      let fullText = '';
      for await (const part of stream) {
        const token = part.choices[0]?.delta?.content ?? '';
        if (token) {
          fullText += token;
          onToken(token);
        }
      }

      if (fullText.trim()) return fullText;
      return this.streamFallbackAnswer(contextEntries, locale, onToken);
    } catch (err) {
      this.logger.warn(`OpenAI stream failed: ${(err as Error).message}`);
      return this.streamFallbackAnswer(contextEntries, locale, onToken);
    }
  }

  /**
   * Stream a pre-composed static answer (keyword fast-path).
   * @param text - Full answer text
   * @param onToken - Per-chunk callback
   */
  async streamStaticText(text: string, onToken: (token: string) => void): Promise<string> {
    await this.emitChunked(text, onToken);
    return text;
  }

  /**
   * Simulate streaming by chunking a static KB answer (used when AI is unavailable).
   * @param entries - FAQ entries to derive answer from
   * @param locale - User locale
   * @param onToken - Token callback for real-time UX
   */
  async streamFallbackAnswer(
    entries: FaqKnowledgeEntry[],
    locale: string,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (entries.length === 0) {
      const fallback =
        locale === 'am'
          ? 'ይቅርታ፣ ለዚህ ጥያቄ ትክክለኛ መልስ ማግኘት አልቻልኩም። እባክዎ የድጋፍ ቡድናችንን ያግኙ us@beleqet.com።'
          : 'Sorry, I could not find a matching answer. Please contact our support team at support@beleqet.com.';
      await this.emitChunked(fallback, onToken);
      return fallback;
    }

    const { answer } = this.knowledgeRetrieval.localizeEntry(entries[0], locale);
    await this.emitChunked(answer, onToken);
    return answer;
  }

  /**
   * Emit text in small chunks to mimic token streaming.
   * @param text - Full text to stream
   * @param onToken - Per-chunk callback
   */
  private async emitChunked(text: string, onToken: (token: string) => void): Promise<void> {
    const chunkSize = 12;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      onToken(chunk);
      await new Promise((r) => setTimeout(r, 15));
    }
  }
}
