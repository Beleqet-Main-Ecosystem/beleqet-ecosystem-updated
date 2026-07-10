import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QualityAnalyzerService } from './quality-analyzer.service';
import { ReportService } from './report.service';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { PlagiarismConfig } from '../utils/plagiarism.config';

describe('QualityAnalyzerService', () => {
  let analyzer: QualityAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QualityAnalyzerService, TokenizerService],
    }).compile();

    analyzer = module.get<QualityAnalyzerService>(QualityAnalyzerService);
  });

  it('scores high originality for low similarity', () => {
    const assessment = analyzer.analyze(
      'Unique professional content about software engineering and cloud architecture with detailed experience.',
      0.1,
    );
    expect(assessment.originality).toBeGreaterThan(0.8);
  });

  it('detects duplicate sentences', () => {
    const text =
      'We build great products. We build great products. Our team delivers quality software solutions.';
    const assessment = analyzer.analyze(text, 0);
    expect(assessment.duplicateSentences).toBeGreaterThan(0);
  });

  it('computes overall quality score', () => {
    const assessment = analyzer.analyze(
      'Professional software engineer with extensive experience in backend development, API design, and database optimization for enterprise applications.',
      0.05,
    );
    const score = analyzer.computeQualityScore(assessment);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('ReportService', () => {
  let reportService: ReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        QualityAnalyzerService,
        TokenizerService,
        PlagiarismConfig,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    reportService = module.get<ReportService>(ReportService);
  });

  it('generates verdict based on similarity thresholds', () => {
    const report = reportService.buildReport({
      inputText: 'Sample text for testing the report generation service.',
      inputChunks: [{ index: 0, text: 'Sample text', type: 'paragraph' }],
      matches: [
        {
          sourceType: 'platform',
          entityType: 'Job',
          entityId: '1',
          title: 'Test Job',
          similarity: 0.75,
          algorithmScores: { jaccard: 0.7, cosine: 0.8, ngram: 0.6, semantic: 0.8 },
          matchedChunks: [],
          matchedPhrases: [],
          matchedTokens: [],
        },
      ],
      platformDocCount: 10,
      internetDocCount: 2,
    });

    expect(report.verdict).toBe('likely_plagiarized');
    expect(report.overallSimilarity).toBe(0.75);
    expect(report.qualityScore).toBeGreaterThan(0);
    expect(report.sourcesChecked).toBe(10);
    expect(report.internetSourcesChecked).toBe(2);
  });

  it('returns original verdict for low similarity', () => {
    const report = reportService.buildReport({
      inputText: 'Completely original content about unique topics and experiences.',
      inputChunks: [],
      matches: [],
      platformDocCount: 5,
      internetDocCount: 0,
    });

    expect(report.verdict).toBe('original');
    expect(report.overallSimilarity).toBe(0);
  });
});
