import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChunkerService } from './chunker.service';
import { PlagiarismConfig } from '../utils/plagiarism.config';

describe('ChunkerService', () => {
  let chunker: ChunkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChunkerService,
        PlagiarismConfig,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    chunker = module.get<ChunkerService>(ChunkerService);
  });

  it('splits text into paragraphs', () => {
    const text = 'First paragraph with enough content here.\n\nSecond paragraph with different content.';
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0].type).toBe('paragraph');
  });

  it('splits large paragraphs into sentences', () => {
    const longSentence = 'This is a sentence that forms part of a very large paragraph. '.repeat(20);
    const chunks = chunker.chunk(longSentence);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((c) => c.type === 'sentence')).toBe(true);
  });

  it('returns at least one chunk for non-empty text', () => {
    const chunks = chunker.chunk('Short text content here for testing purposes.');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
