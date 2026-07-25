import { ConfigService } from '@nestjs/config';
import type { PromptTemplate } from '../prompts/prompt-template.interface';
import { OpenAILLMProvider } from '../services/openai-llm.provider';

const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe('OpenAILLMProvider', () => {
  let provider: OpenAILLMProvider;
  let configService: jest.Mocked<ConfigService>;

  const mockPrompt: PromptTemplate = {
    systemPrompt: 'You are a hiring evaluator.',
    userPrompt: 'Evaluate this candidate.',
    requiredVariables: [],
  };

  beforeEach(() => {
    mockCreate.mockClear();
    configService = {
      get: jest.fn().mockReturnValue('sk-test-key'),
    } as unknown as jest.Mocked<ConfigService>;

    provider = new OpenAILLMProvider(configService);
  });

  describe('constructor', () => {
    it('should throw when OPENAI_API_KEY is not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => new OpenAILLMProvider(configService)).toThrow(
        'OPENAI_API_KEY is not configured',
      );
    });
  });

  describe('evaluate', () => {
    it('should return parsed LlmResponse on success', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'STRONG_MATCH',
                confidence: 0.92,
                reasoning: 'Excellent fit.',
                skillGaps: ['Docker'],
                strengths: ['React', 'Node.js'],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.decision).toBe('STRONG_MATCH');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('Excellent fit.');
      expect(result.skillGaps).toEqual(['Docker']);
      expect(result.strengths).toEqual(['React', 'Node.js']);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should populate tokenUsage from response usage', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'POTENTIAL_MATCH',
                confidence: 0.65,
                reasoning: 'Okay.',
                skillGaps: [],
                strengths: [],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.tokenUsage.prompt).toBe(50);
      expect(result.tokenUsage.completion).toBe(30);
      expect(result.tokenUsage.total).toBe(80);
    });

    it('should include rawOutput in the response', async () => {
      const raw = JSON.stringify({
        decision: 'WEAK_MATCH',
        confidence: 0.3,
        reasoning: 'Not ideal.',
        skillGaps: ['All'],
        strengths: [],
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: raw } }],
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.rawOutput).toBe(raw);
    });

    it('should send system and user prompts to the API', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'STRONG_MATCH',
                confidence: 0.9,
                reasoning: 'Great.',
                skillGaps: [],
                strengths: [],
              }),
            },
          },
        ],
      });

      await provider.evaluate(mockPrompt);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a hiring evaluator.' },
            { role: 'user', content: 'Evaluate this candidate.' },
          ],
          temperature: 0,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should throw when response content is empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      });

      await expect(provider.evaluate(mockPrompt)).rejects.toThrow(
        'No JSON object found in LLM response',
      );
    });

    it('should throw on invalid decision value', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'INVALID_DECISION',
                confidence: 0.5,
                reasoning: 'Hmm.',
                skillGaps: [],
                strengths: [],
              }),
            },
          },
        ],
      });

      await expect(provider.evaluate(mockPrompt)).rejects.toThrow('Invalid decision from LLM');
    });

    it('should throw when no JSON is found in output', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Just some text without JSON.' } }],
      });

      await expect(provider.evaluate(mockPrompt)).rejects.toThrow(
        'No JSON object found in LLM response',
      );
    });

    it('should extract JSON from markdown-fenced blocks', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '```json\n{"decision":"STRONG_MATCH","confidence":0.9,"reasoning":"Great.","skillGaps":[],"strengths":[]}\n```',
            },
          },
        ],
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.decision).toBe('STRONG_MATCH');
    });

    it('should default missing arrays to empty arrays', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'STRONG_MATCH',
                confidence: 0.9,
                reasoning: 'Great.',
              }),
            },
          },
        ],
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.skillGaps).toEqual([]);
      expect(result.strengths).toEqual([]);
    });

    it('should default reasoning to empty string when missing', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'STRONG_MATCH',
                confidence: 0.9,
              }),
            },
          },
        ],
      });

      const result = await provider.evaluate(mockPrompt);

      expect(result.reasoning).toBe('');
    });

    it('should rethrow API errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(provider.evaluate(mockPrompt)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
