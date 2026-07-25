import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { LlmProvider } from './llm-provider.token';
import type { PromptTemplate } from '../prompts/prompt-template.interface';
import type { LlmResponse, TokenUsage } from '../interfaces/llm-response.interface';
import type { EvaluationDecision } from '../interfaces/evaluation.interface';
import { extractJsonObject, safeJsonParse } from '../utils/json-parser.util';

/** Raw shape of the JSON the LLM is instructed to return. */
interface LlmRawEvaluation {
  decision: EvaluationDecision;
  confidence: number;
  reasoning: string;
  skillGaps: string[];
  strengths: string[];
}

const VALID_DECISIONS: readonly string[] = [
  'STRONG_MATCH',
  'POTENTIAL_MATCH',
  'WEAK_MATCH',
  'NOT_A_MATCH',
];

/**
 * Concrete LlmProvider that communicates with the OpenAI Chat Completions API.
 *
 * Injects ConfigService to read OPENAI_API_KEY and OPENAI_LLM_MODEL.
 * All OpenAI SDK usage is isolated within this class.
 */
@Injectable()
export class OpenAILLMProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAILLMProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const baseURL = configService.get<string>('OPENAI_BASE_URL') ?? undefined;
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = configService.get<string>('OPENAI_LLM_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Send a prompt to the LLM and return the raw response content.
   * Uses JSON mode. Does NOT validate the response structure — caller parses.
   *
   * @param prompt - Fully interpolated PromptTemplate.
   * @returns Raw response text from the LLM.
   */
  async generate(prompt: PromptTemplate): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        temperature: 0,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.logger.error(
        'OpenAI chat completion (generate) failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Evaluate a candidate against a job by sending the prompt to OpenAI.
   *
   * Uses JSON mode (response_format: { type: 'json_object' }) to enforce
   * structured output, then parses and validates the response.
   *
   * @param prompt - Fully interpolated PromptTemplate with system + user prompts.
   * @returns LlmResponse with decision, confidence, reasoning, and metadata.
   */
  async evaluate(prompt: PromptTemplate): Promise<LlmResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        temperature: 0,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startTime;
      const rawOutput = response.choices[0]?.message?.content ?? '';
      const usage = response.usage;

      const tokenUsage: TokenUsage = {
        prompt: usage?.prompt_tokens ?? 0,
        completion: usage?.completion_tokens ?? 0,
        total: usage?.total_tokens ?? 0,
      };

      const parsed = this.parseRawOutput(rawOutput);

      return {
        decision: parsed.decision,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        skillGaps: parsed.skillGaps,
        strengths: parsed.strengths,
        rawOutput,
        tokenUsage,
        latencyMs,
      };
    } catch (error) {
      this.logger.error(
        'OpenAI chat completion failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Extract and validate the JSON object from the raw LLM output string.
   *
   * Uses extractJsonObject + safeJsonParse for resilience against
   * minor formatting deviations.
   *
   * @param rawOutput - Raw text returned by the LLM.
   * @returns Validated LlmRawEvaluation.
   */
  private parseRawOutput(rawOutput: string): LlmRawEvaluation {
    const jsonStr = extractJsonObject(rawOutput);
    if (!jsonStr) {
      throw new Error('No JSON object found in LLM response');
    }

    const parsed = safeJsonParse<LlmRawEvaluation>(jsonStr);
    if (!parsed) {
      throw new Error('Failed to parse JSON from LLM response');
    }

    if (!VALID_DECISIONS.includes(parsed.decision)) {
      throw new Error(`Invalid decision from LLM: "${parsed.decision}"`);
    }

    return {
      decision: parsed.decision as EvaluationDecision,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning ?? '',
      skillGaps: Array.isArray(parsed.skillGaps) ? parsed.skillGaps : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    };
  }
}
