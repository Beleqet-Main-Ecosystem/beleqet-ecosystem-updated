import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { VideoInterviewService } from './video-interview.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, VIDEO_INTERVIEW_JOBS } from '../queues/queues.constants';

/**
 * Integration-style coverage: AI Video Interview coexists with the
 * multi-currency payment / referral domain (Payment.currency, Referral.currency)
 * without schema or queue-name clashes.
 *
 * Creates an interview session for a candidate who also has multi-currency
 * payment + referral records; asserts interview CRUD is unrelated to currency
 * fields and does not corrupt them.
 */
describe('VideoInterview × Multi-Currency Integration', () => {
  const candidateId = 'user-candidate-1';
  const employerId = 'user-employer-1';
  const applicationId = 'app-1';

  const paymentStore = [
    {
      id: 'pay-1',
      userId: candidateId,
      currency: 'USD',
      amount: 2500,
      status: 'SUCCEEDED',
    },
    {
      id: 'pay-2',
      userId: candidateId,
      currency: 'ETB',
      amount: 150_000,
      status: 'PENDING',
    },
  ];

  const referralStore = [
    {
      id: 'ref-1',
      referrerId: candidateId,
      currency: 'EUR',
      bonusAmount: 500,
      status: 'PENDING',
    },
  ];

  let createdSession: Record<string, unknown> | null = null;

  const mockPrisma = {
    application: {
      findFirst: jest.fn().mockResolvedValue({
        id: applicationId,
        userId: candidateId,
        job: { company: { userId: employerId }, title: 'Backend Engineer' },
      }),
    },
    videoInterview: {
      findUnique: jest.fn().mockImplementation(async () => createdSession),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        createdSession = { id: 'vi-1', ...data };
        return createdSession;
      }),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    videoResponse: { upsert: jest.fn(), updateMany: jest.fn() },
    interviewEvaluation: { deleteMany: jest.fn() },
    payment: {
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: { where: { userId: string } }) =>
          paymentStore.filter((p) => p.userId === where.userId),
        ),
    },
    referral: {
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: { where: { referrerId: string } }) =>
          referralStore.filter((r) => r.referrerId === where.referrerId),
        ),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };

  const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'q1' }) };

  let service: VideoInterviewService;
  let prisma: typeof mockPrisma;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    createdSession = null;
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      providers: [
        VideoInterviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: { t: jest.fn(async (k: string) => k) } },
        { provide: CircuitBreakerService, useValue: { execute: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fb?: string) => {
              if (key === 'R2_PUBLIC_BASE_URL') return 'https://cdn.beleqet.com';
              if (key === 'AWS_S3_BUCKET') return 'beleqet-uploads';
              if (key === 'AWS_REGION') return 'us-east-1';
              return fb ?? '';
            },
          },
        },
        { provide: getQueueToken(QUEUE_NAMES.VIDEO_INTERVIEW), useValue: mockQueue },
      ],
    }).compile();

    service = moduleRef.get(VideoInterviewService);
    prisma = mockPrisma;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a video interview without mutating multi-currency payment/referral rows', async () => {
    const paymentsBefore = await prisma.payment.findMany({ where: { userId: candidateId } });
    const referralsBefore = await prisma.referral.findMany({ where: { referrerId: candidateId } });

    expect(paymentsBefore.map((p: { currency: string }) => p.currency).sort()).toEqual([
      'ETB',
      'USD',
    ]);
    expect(referralsBefore[0].currency).toBe('EUR');

    const session = await service.createSession(employerId, {
      applicationId,
      questions: [{ id: 'q1', text: 'Introduce yourself', durationSec: 90 }],
      locale: 'en',
    });

    expect(session).toMatchObject({
      id: 'vi-1',
      applicationId,
      userId: candidateId,
      status: 'PENDING',
    });

    const paymentsAfter = await prisma.payment.findMany({ where: { userId: candidateId } });
    const referralsAfter = await prisma.referral.findMany({ where: { referrerId: candidateId } });

    expect(paymentsAfter).toEqual(paymentsBefore);
    expect(referralsAfter).toEqual(referralsBefore);
  });

  it('uses the dedicated video-interview queue (not referral/job-alert queues)', async () => {
    createdSession = {
      id: 'vi-1',
      userId: candidateId,
      status: 'PENDING',
      expiresAt: null,
      metadata: { questions: [{ id: 'q1', text: 'Q', durationSec: 60 }] },
      responses: [],
    };
    mockPrisma.videoResponse.upsert.mockResolvedValue({ id: 'resp-1' });

    await service.submitResponse('vi-1', candidateId, {
      questionIndex: 0,
      videoUrl: 'https://cdn.beleqet.com/a.webm',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      VIDEO_INTERVIEW_JOBS.TRANSCRIBE,
      expect.objectContaining({ responseId: 'resp-1', sessionId: 'vi-1' }),
      expect.any(Object),
    );
    expect(QUEUE_NAMES.VIDEO_INTERVIEW).not.toBe(QUEUE_NAMES.REFERRALS);
    expect(QUEUE_NAMES.VIDEO_INTERVIEW).not.toBe(QUEUE_NAMES.JOB_ALERTS);
  });
});
