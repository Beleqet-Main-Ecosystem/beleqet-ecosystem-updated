import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  OpenAiResumeExtractionProvider,
  resumeAiVendor,
} from './openai-resume-extraction.provider';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

const configWith = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  }) as unknown as ConfigService;

describe('resumeAiVendor', () => {
  it('uses Groq when a Groq key is set', () => {
    expect(resumeAiVendor(configWith({ GROQ_API_KEY: 'gsk', OPENAI_API_KEY: 'sk' }))).toBe('groq');
  });

  it('uses OpenAI when there is no Groq key', () => {
    expect(resumeAiVendor(configWith({ OPENAI_API_KEY: 'sk' }))).toBe('openai');
  });

  it('follows RESUME_EXTRACTION_PROVIDER when set', () => {
    expect(
      resumeAiVendor(configWith({ GROQ_API_KEY: 'gsk', RESUME_EXTRACTION_PROVIDER: 'OpenAI' })),
    ).toBe('openai');
  });
});

describe('OpenAiResumeExtractionProvider on Groq', () => {
  beforeEach(() => jest.clearAllMocks());

  it('points the client at Groq with the Groq key and model', () => {
    const provider = new OpenAiResumeExtractionProvider(
      configWith({ GROQ_API_KEY: 'gsk-test', OPENAI_API_KEY: 'sk-test' }),
    );
    expect(provider.engineId).toBe('groq:openai/gpt-oss-20b');
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'gsk-test',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  });

  it('refuses to start in production without a Groq key when Groq is chosen', () => {
    expect(
      () =>
        new OpenAiResumeExtractionProvider(
          configWith({ NODE_ENV: 'production', RESUME_EXTRACTION_PROVIDER: 'groq' }),
        ),
    ).toThrow(/GROQ_API_KEY/);
  });
});

describe('OpenAiResumeExtractionProvider', () => {
  let provider: OpenAiResumeExtractionProvider;
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          OPENAI_API_KEY: 'sk-test-key',
          OPENAI_MODEL: 'gpt-4o-mini',
        };
        return values[key] ?? fallback;
      }),
    };
    provider = new OpenAiResumeExtractionProvider(config as unknown as ConfigService);
  });

  it('should expose an engineId derived from the configured model', () => {
    expect(provider.engineId).toBe('openai:gpt-4o-mini');
  });

  it('should throw on construction when no API key is configured in production', () => {
    const prodConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          NODE_ENV: 'production',
          OPENAI_MODEL: 'gpt-4o-mini',
        };
        return values[key] ?? fallback;
      }),
    };

    expect(
      () => new OpenAiResumeExtractionProvider(prodConfig as unknown as ConfigService),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it('should not throw when no API key is configured outside production', () => {
    const devConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = { NODE_ENV: 'test', OPENAI_MODEL: 'gpt-4o-mini' };
        return values[key] ?? fallback;
      }),
    };

    expect(
      () => new OpenAiResumeExtractionProvider(devConfig as unknown as ConfigService),
    ).not.toThrow();
  });

  it('should return a fully-populated ExtractedResumeDto on a valid AI response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              personalInfo: {
                fullName: 'Selam Tesfaye',
                email: 'selam@example.com',
                phone: null,
                location: null,
              },
              education: [
                {
                  institution: 'AAU',
                  degree: 'BSc',
                  fieldOfStudy: 'CS',
                  startDate: '2018-09-01',
                  endDate: '2022-06-30',
                },
              ],
              workExperience: [
                {
                  company: 'Beleqet',
                  title: 'Engineer',
                  startDate: '2022-07-01',
                  endDate: null,
                  description: 'Built things',
                  compensation: { amount: '45000.00', currencyCode: 'ETB' },
                },
              ],
              skills: ['TypeScript', 'NestJS'],
              certifications: ['AWS Certified Cloud Practitioner'],
              languages: [{ language: 'Amharic', proficiency: 'Native' }],
            }),
          },
        },
      ],
    });

    const result = await provider.extract('raw cv text');

    expect(result.personalInfo.fullName).toBe('Selam Tesfaye');
    expect(result.education).toHaveLength(1);
    expect(result.workExperience[0].compensation).toEqual({
      amount: '45000.00',
      currencyCode: 'ETB',
    });
    expect(result.skills).toEqual(['TypeScript', 'NestJS']);
  });

  it('should return safe empty defaults when the AI call throws', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));

    const result = await provider.extract('raw cv text');

    expect(result.personalInfo).toEqual({});
    expect(result.education).toEqual([]);
    expect(result.workExperience).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.languages).toEqual([]);
  });

  it('should return safe empty defaults when the AI response is not valid JSON', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });

    const result = await provider.extract('raw cv text');

    expect(result.education).toEqual([]);
  });
});
