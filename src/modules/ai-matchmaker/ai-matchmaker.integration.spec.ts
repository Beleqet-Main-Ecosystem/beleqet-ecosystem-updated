import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AiMatchmakerController } from './ai-matchmaker.controller';
import { AiMatchmakerService } from './ai-matchmaker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

describe('AiMatchmaker Integration Tests', () => {
  let app: INestApplication;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      enqueueJobMatching: jest.fn().mockResolvedValue({ queued: true, jobId: 'job-1' }),
      calculateAndPersistMatch: jest.fn().mockResolvedValue({ id: 'm1', totalScore: 85 }),
      getRankedCandidatesForJob: jest
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
      getRankedJobsForCandidate: jest
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
      getMatchAnalytics: jest
        .fn()
        .mockResolvedValue({ totalEvaluatedMatches: 10, averageTotalScore: 78 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AiMatchmakerController],
      providers: [
        { provide: AiMatchmakerService, useValue: serviceMock },
        { provide: PrismaService, useValue: {} },
        { provide: getQueueToken(QUEUE_NAMES.AI_MATCHMAKER), useValue: { add: jest.fn() } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should be defined and initialize NestJS controller', () => {
    const controller = app.get<AiMatchmakerController>(AiMatchmakerController);
    expect(controller).toBeDefined();
  });
});
