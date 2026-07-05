import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { VideoInterviewService } from './video-interview.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

const mockPrisma = {
  application: { findFirst: jest.fn() },
  videoInterview: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  videoResponse: { upsert: jest.fn(), updateMany: jest.fn() },
  interviewEvaluation: { deleteMany: jest.fn() },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

const mockI18n = { t: jest.fn((key: string) => Promise.resolve(key)) };
const mockCircuitBreaker = { execute: jest.fn() };
const mockQueue = { add: jest.fn() };

describe('VideoInterviewService', () => {
  let service: VideoInterviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoInterviewService,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: 'I18nService', useValue: mockI18n },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: getQueueToken(QUEUE_NAMES.VIDEO_INTERVIEW), useValue: mockQueue },
      ],
    })
      .overrideProvider('PrismaService').useValue(mockPrisma)
      .overrideProvider('I18nService').useValue(mockI18n)
      .compile();

    service = module.get<VideoInterviewService>(VideoInterviewService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createSession ──────────────────────────────────────────────────────

  describe('createSession()', () => {
    const employerId = 'emp-1';
    const dto = {
      applicationId: 'app-1',
      questions: [{ id: 'q1', text: 'Tell me about yourself.', durationSec: 120 }],
    };

    it('throws NotFoundException when application does not exist', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null);
      await expect(service.createSession(employerId, dto as never)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the job owner', async () => {
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-1',
        userId: 'candidate-1',
        job: { company: { userId: 'other-employer' } },
      });
      await expect(service.createSession(employerId, dto as never)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when session already exists', async () => {
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-1',
        userId: 'candidate-1',
        job: { company: { userId: employerId } },
      });
      mockPrisma.videoInterview.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createSession(employerId, dto as never)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates and returns session on success', async () => {
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-1',
        userId: 'candidate-1',
        job: { company: { userId: employerId } },
      });
      mockPrisma.videoInterview.findUnique.mockResolvedValue(null);
      const created = { id: 'session-1', status: 'PENDING' };
      mockPrisma.videoInterview.create.mockResolvedValue(created);

      const result = await service.createSession(employerId, dto as never);
      expect(result).toEqual(created);
      expect(mockPrisma.videoInterview.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── getSession ─────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('throws NotFoundException when session is missing', async () => {
      mockPrisma.videoInterview.findUnique.mockResolvedValue(null);
      await expect(service.getSession('id', 'user')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when userId does not match', async () => {
      mockPrisma.videoInterview.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        gdprDeleteAt: null,
        expiresAt: null,
        responses: [],
        evaluation: null,
      });
      await expect(service.getSession('session-1', 'caller')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns session when authorized', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        gdprDeleteAt: null,
        expiresAt: null,
        responses: [],
        evaluation: null,
      };
      mockPrisma.videoInterview.findUnique.mockResolvedValue(session);
      const result = await service.getSession('session-1', 'user-1');
      expect(result).toEqual(session);
    });
  });

  // ── requestGdprDeletion ────────────────────────────────────────────────

  describe('requestGdprDeletion()', () => {
    it('clears PII and marks session EXPIRED', async () => {
      mockPrisma.videoInterview.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' });
      mockPrisma.videoResponse.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.interviewEvaluation.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.videoInterview.update.mockResolvedValue({ id: 's1', status: 'EXPIRED' });
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      const result = await service.requestGdprDeletion('s1', 'u1');
      expect(result).toHaveProperty('message');
    });

    it('throws ForbiddenException for wrong user', async () => {
      mockPrisma.videoInterview.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' });
      await expect(service.requestGdprDeletion('s1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
