import { Injectable } from '@nestjs/common';
import type { LlmProvider } from './llm-provider.token';
import type { PromptTemplate } from '../prompts/prompt-template.interface';
import type { LlmResponse } from '../interfaces/llm-response.interface';

const DECISIONS = ['STRONG_MATCH', 'POTENTIAL_MATCH', 'WEAK_MATCH', 'NOT_A_MATCH'] as const;

/**
 * Mock LlmProvider that returns randomized but plausible evaluation results.
 * Used for development/demo when no real LLM API is available.
 */
@Injectable()
export class MockLLMProvider implements LlmProvider {
  async evaluate(prompt: PromptTemplate): Promise<LlmResponse> {
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

    const decisionIndex = Math.floor(Math.random() * 4);
    const decision = DECISIONS[decisionIndex];
    const confidence = +(0.3 + Math.random() * 0.7).toFixed(2);

    return {
      decision,
      confidence,
      reasoning: `Mock evaluation: ${decision.toLowerCase().replace(/_/g, ' ')}`,
      skillGaps: decision === 'NOT_A_MATCH' ? ['relevant experience', 'required skills'] : [],
      strengths: decision !== 'NOT_A_MATCH' ? ['mock skill match', 'mock experience'] : [],
      rawOutput: JSON.stringify({
        decision,
        confidence,
        reasoning: 'mock',
        skillGaps: [],
        strengths: [],
      }),
      tokenUsage: { prompt: 100, completion: 50, total: 150 },
      latencyMs: 50,
    };
  }

  async generate(prompt: PromptTemplate): Promise<string> {
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

    const mockResponse = {
      optimizationScore: 65 + Math.floor(Math.random() * 30),
      bioQuality: Math.random() > 0.5 ? 'good' : 'needs_improvement',
      suggestedImprovements: [
        'Add more specific technologies to your skills section',
        'Expand your bio to at least 400 characters',
      ],
      trendingSkillsInMarket: ['GraphQL', 'Terraform', 'Next.js'],
      containsRelevantKeywords: Math.random() > 0.3,
    };

    return JSON.stringify(mockResponse);
  }
}
