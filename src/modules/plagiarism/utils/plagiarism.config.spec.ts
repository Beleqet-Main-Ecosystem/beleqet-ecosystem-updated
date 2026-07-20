import { ConfigService } from '@nestjs/config';
import { PlagiarismConfig } from './plagiarism.config';

describe('PlagiarismConfig', () => {
  const createConfig = (env: Record<string, string> = {}) => {
    const configService = {
      get: (key: string) => env[key],
    } as ConfigService;
    return new PlagiarismConfig(configService);
  };

  it('uses default threshold', () => {
    const config = createConfig();
    expect(config.threshold).toBe(0.25);
  });

  it('parses custom threshold from env', () => {
    const config = createConfig({ PLAGIARISM_THRESHOLD: '0.4' });
    expect(config.threshold).toBe(0.4);
  });

  it('resolves original verdict', () => {
    const config = createConfig();
    expect(config.resolveVerdict(0.1)).toBe('original');
  });

  it('resolves suspicious verdict', () => {
    const config = createConfig();
    expect(config.resolveVerdict(0.45)).toBe('suspicious');
  });

  it('resolves likely_plagiarized verdict', () => {
    const config = createConfig();
    expect(config.resolveVerdict(0.75)).toBe('likely_plagiarized');
  });

  it('parses similarity weights from JSON env', () => {
    const config = createConfig({
      SIMILARITY_WEIGHTS: '{"jaccard":0.1,"cosine":0.3,"ngram":0.2,"semantic":0.4}',
    });
    expect(config.similarityWeights.jaccard).toBe(0.1);
    expect(config.similarityWeights.semantic).toBe(0.4);
  });
});
