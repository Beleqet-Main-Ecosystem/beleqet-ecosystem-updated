import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { VideoInterviewProcessor } from './video-interview.processor';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FfmpegService } from './ffmpeg.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, VIDEO_INTERVIEW_JOBS, REFERRAL_JOBS, JOB_ALERT_JOBS } from '../queues/queues.constants';

const mockPrisma = {
  videoResponse: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  videoInterview: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  interviewEvaluation: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
};

const mockQueue = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
const mockCircuitBreaker = {
  execute: jest.fn(async (_name: string, action: () => Promise<unknown>) => action()),
};
const mockFfmpeg = {
  downloadToTempFile: jest.fn(),
  stripMetadataFromFile: jest.fn(),
  extractAudioFromFile: jest.fn(),
};
const mockI18n = { t: jest.fn((k: string) => Promise.resolve(k)) };
const mockConfig = { get: jest.fn((_k: string, fb?: string) => fb ?? 'dummy') };

describe('VideoInterviewProcessor', () => {
  let processor: VideoInterviewProcessor;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        VideoInterviewProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: FfmpegService, useValue: mockFfmpeg },
        { provide: I18nService, useValue: mockI18n },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken(QUEUE_NAMES.VIDEO_INTERVIEW), useValue: mockQueue },
      ],
    }).compile();

    processor = moduleRef.get(VideoInterviewProcessor);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await moduleRef.close();
  });

  describe('cleanupExpiredInterviews()', () => {
    it('wipes JSONB PII with Prisma.DbNull (not undefined)', async () => {
      mockPrisma.videoInterview.findMany.mockResolvedValue([{ id: 'sess-1' }]);
      mockPrisma.videoResponse.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.interviewEvaluation.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.videoInterview.update.mockResolvedValue({ id: 'sess-1', status: 'EXPIRED' });

      await processor.cleanupExpiredInterviews();

      expect(mockPrisma.videoResponse.updateMany).toHaveBeenCalledWith({
        where: { videoInterviewId: 'sess-1' },
        data: {
          videoUrl: null,
          transcript: null,
          rawWhisperResponse: Prisma.DbNull,
        },
      });
    });
  });

  describe('processTranscription() → maybeEnqueueEvaluation()', () => {
    it('claims session once and enqueues EVALUATE with stable jobId', async () => {
      mockPrisma.videoResponse.findUnique.mockResolvedValue({
        id: 'resp-1',
        videoUrl: 'https://cdn.example/v.webm',
        language: 'en',
      });
      mockPrisma.videoResponse.update.mockResolvedValue({});
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        text: 'hello',
        segments: [],
        language: 'en',
        duration: 1,
      });

      mockPrisma.videoInterview.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'IN_PROGRESS',
        metadata: { questions: [{ id: 'q1' }, { id: 'q2' }] },
        responses: [
          { processingStatus: 'TRANSCRIBED' },
          { processingStatus: 'TRANSCRIBED' },
        ],
      });
      mockPrisma.videoInterview.updateMany.mockResolvedValue({ count: 1 });
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await processor.processTranscription({
        data: { responseId: 'resp-1', sessionId: 'sess-1', lang: 'en' },
      } as never);

      expect(mockPrisma.videoInterview.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'sess-1',
          status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] },
        },
        data: { status: 'PROCESSING' },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        VIDEO_INTERVIEW_JOBS.EVALUATE,
        { sessionId: 'sess-1', lang: 'en' },
        expect.objectContaining({ jobId: 'evaluate-sess-1' }),
      );
    });

    it('re-claims COMPLETED sessions after re-record and removes prior EVALUATE job', async () => {
      mockPrisma.videoResponse.findUnique.mockResolvedValue({
        id: 'resp-3',
        videoUrl: 'https://cdn.example/v.webm',
        language: 'en',
      });
      mockPrisma.videoResponse.update.mockResolvedValue({});
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        text: 'hello again',
        segments: [],
        language: 'en',
        duration: 1,
      });

      mockPrisma.videoInterview.findUnique.mockResolvedValue({
        id: 'sess-3',
        status: 'COMPLETED',
        metadata: { questions: [{ id: 'q1' }] },
        responses: [{ processingStatus: 'TRANSCRIBED' }],
      });
      mockPrisma.videoInterview.updateMany.mockResolvedValue({ count: 1 });
      const remove = jest.fn().mockResolvedValue(undefined);
      mockQueue.getJob.mockResolvedValueOnce({
        remove,
        getState: jest.fn().mockResolvedValue('completed'),
      });
      mockQueue.add.mockResolvedValue({ id: 'job-2' });

      await processor.processTranscription({
        data: { responseId: 'resp-3', sessionId: 'sess-3', lang: 'en' },
      } as never);

      expect(remove).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        VIDEO_INTERVIEW_JOBS.EVALUATE,
        { sessionId: 'sess-3', lang: 'en' },
        expect.objectContaining({ jobId: 'evaluate-sess-3' }),
      );
    });

    it('does not remove an active EVALUATE job (avoids BullMQ crash)', async () => {
      mockPrisma.videoResponse.findUnique.mockResolvedValue({
        id: 'resp-4',
        videoUrl: 'https://cdn.example/v.webm',
        language: 'en',
      });
      mockPrisma.videoResponse.update.mockResolvedValue({});
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        text: 'hello',
        segments: [],
        language: 'en',
        duration: 1,
      });

      mockPrisma.videoInterview.findUnique.mockResolvedValue({
        id: 'sess-4',
        status: 'IN_PROGRESS',
        metadata: { questions: [{ id: 'q1' }] },
        responses: [{ processingStatus: 'TRANSCRIBED' }],
      });
      mockPrisma.videoInterview.updateMany.mockResolvedValue({ count: 1 });
      const remove = jest.fn();
      mockQueue.getJob.mockResolvedValueOnce({
        remove,
        getState: jest.fn().mockResolvedValue('active'),
      });

      await processor.processTranscription({
        data: { responseId: 'resp-4', sessionId: 'sess-4', lang: 'en' },
      } as never);

      expect(remove).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('does not enqueue a second EVALUATE when another worker already claimed', async () => {
      mockPrisma.videoResponse.findUnique.mockResolvedValue({
        id: 'resp-2',
        videoUrl: 'https://cdn.example/v.webm',
        language: 'en',
      });
      mockPrisma.videoResponse.update.mockResolvedValue({});
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        text: 'hello',
        segments: [],
        language: 'en',
        duration: 1,
      });

      mockPrisma.videoInterview.findUnique.mockResolvedValue({
        id: 'sess-2',
        status: 'IN_PROGRESS',
        metadata: { questions: [{ id: 'q1' }] },
        responses: [{ processingStatus: 'TRANSCRIBED' }],
      });
      // Another worker already flipped status → claim loses
      mockPrisma.videoInterview.updateMany.mockResolvedValue({ count: 0 });

      await processor.processTranscription({
        data: { responseId: 'resp-2', sessionId: 'sess-2', lang: 'en' },
      } as never);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});

/**
 * Lightweight coexistence check: video-interview constants sit alongside
 * multi-currency referral / job-alert queue jobs without collision.
 */
describe('Video interview × multi-currency queue coexistence', () => {
  it('registers distinct queue names and job types', () => {
    expect(QUEUE_NAMES.VIDEO_INTERVIEW).toBe('video-interview');
    expect(QUEUE_NAMES.REFERRALS).toBe('referrals');
    expect(QUEUE_NAMES.JOB_ALERTS).toBe('job-alerts');
    expect(REFERRAL_JOBS.AWARD_BONUS).toBeDefined();
    expect(JOB_ALERT_JOBS.DISPATCH_ALERTS).toBeDefined();
    expect(VIDEO_INTERVIEW_JOBS.EVALUATE).not.toEqual(REFERRAL_JOBS.AWARD_BONUS);
  });
});
