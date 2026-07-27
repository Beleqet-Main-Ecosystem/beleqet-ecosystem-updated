import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { EmbeddingResult, Embedding } from '../interfaces/embedding.interface';
import type { Job } from '../interfaces/job.interface';
import type { EmbeddingConfig } from '../config/embedding.config';
import { EmbeddingService } from '../services/embedding.service';
import { EMBEDDING_PROVIDER as _EMBEDDING_PROVIDER } from '../services/embedding-provider.token';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockProvider: jest.Mocked<EmbeddingProvider>;

  const mockConfig: EmbeddingConfig = {
    model: 'text-embedding-test',
    dimensions: 1536,
    maxInputLength: 100,
    provider: 'test',
  };

  const mockEmbedding: Embedding = {
    vector: [0.1, 0.2, 0.3],
    model: 'text-embedding-test',
    dimensions: 1536,
  };

  const mockResult: EmbeddingResult = {
    embedding: mockEmbedding,
    sourceText: 'test text',
    tokenCount: 10,
    latencyMs: 50,
  };

  beforeEach(() => {
    mockProvider = {
      generateEmbedding: jest.fn().mockResolvedValue(mockResult),
      generateEmbeddingForJob: jest.fn().mockResolvedValue(mockResult),
    };
    service = new EmbeddingService(mockProvider, mockConfig);
  });

  describe('embedJob', () => {
    it('should normalize the job description before delegating to the provider', async () => {
      const job: Job = {
        id: 'job_1',
        title: 'Senior Developer',
        description: '  We Need A Developer!  ',
        requiredSkills: ['React'],
        preferredSkills: [],
        budget: 5000,
        currency: 'USD',
        locale: 'en',
        employerId: 'emp_1',
        createdAt: new Date(),
      };

      await service.embedJob(job);

      expect(mockProvider.generateEmbeddingForJob).toHaveBeenCalledWith({
        job: {
          ...job,
          description: 'we need a developer!',
        },
      });
    });

    it('should return the embedding result from the provider', async () => {
      const job: Job = {
        id: 'job_1',
        title: 'Test',
        description: 'A test job.',
        requiredSkills: [],
        preferredSkills: [],
        budget: 0,
        currency: 'USD',
        locale: 'en',
        employerId: 'emp_1',
        createdAt: new Date(),
      };

      const result = await service.embedJob(job);

      expect(result).toEqual(mockResult);
    });
  });

  describe('embedText', () => {
    it('should normalize the text before delegating to the provider', async () => {
      await service.embedText('  Hello World  ');

      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('hello world');
    });

    it('should return the embedding result from the provider', async () => {
      const result = await service.embedText('Some text');

      expect(result).toEqual(mockResult);
    });

    it('should truncate text exceeding maxInputLength', async () => {
      const longText = 'a'.repeat(200);

      await service.embedText(longText);

      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('a'.repeat(100));
    });

    it('should not truncate text within maxInputLength', async () => {
      const exactText = 'b'.repeat(100);

      await service.embedText(exactText);

      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(exactText);
    });

    it('should handle empty text', async () => {
      await service.embedText('');

      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('');
    });
  });
});
