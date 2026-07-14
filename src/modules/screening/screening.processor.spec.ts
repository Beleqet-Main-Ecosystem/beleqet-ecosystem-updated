import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScreeningProcessor } from './screening.processor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  application: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  candidateScore: { create: jest.fn() },
  eventLog: { create: jest.fn() },
  company: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'OPENAI_API_KEY') return 'test-key';
    if (key === 'OPENAI_MODEL') return 'gpt-4o-mini';
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    return fallback;
  }),
};

const mockEventEmitter = { emit: jest.fn() };
const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };
const mockAnalyticsQueue = { add: jest.fn().mockResolvedValue({}) };

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({
              overallScore: 85, skillScore: 80, experienceScore: 90, cultureFitScore: 85, reasoning: 'Strong candidate',
            })}}],
          }),
        },
      },
    })),
  };
});

jest.mock('../notifications/email-templates', () => ({
  recruiterApplicationEmail: jest.fn().mockResolvedValue({ html: '<p>test</p>', text: 'test' }),
}));

describe('ScreeningProcessor', () => {
  let processor: ScreeningProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreeningProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
        { provide: getQueueToken('analytics'), useValue: mockAnalyticsQueue },
      ],
    }).compile();
    processor = module.get<ScreeningProcessor>(ScreeningProcessor);
  });

  describe('handleScreenCandidate', () => {
    it('should process screening and assign score', async () => {
      mockPrisma.application.update.mockResolvedValue({});
      mockPrisma.candidateScore.create.mockResolvedValue({});
      mockPrisma.eventLog.create.mockResolvedValue({});

      const job = {
        data: {
          applicationId: 'app-1', userId: 'u1', jobId: 'j1', jobTitle: 'Dev',
          jobDescription: 'Build APIs', jobRequirements: 'NestJS', coverLetter: 'I am a dev',
          resumeUrl: '', companyId: 'c1',
        },
        queue: { add: jest.fn().mockResolvedValue({}) },
      } as any;

      const result = await processor.handleScreenCandidate(job);
      expect(result.applicationId).toBe('app-1');
      expect(result.score).toBe(85);
      expect(result.status).toBe('SHORTLISTED');
      expect(mockPrisma.application.update).toHaveBeenCalled();
      expect(mockPrisma.candidateScore.create).toHaveBeenCalled();
    });
  });

  describe('handleNotifyRecruiter', () => {
    it('should notify recruiter via in-app and email', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        userId: 'emp-1',
        user: { firstName: 'John', email: 'j@t.com', telegramId: null },
      });

      const job = {
        data: { applicationId: 'app-1', jobTitle: 'Dev', companyId: 'c1', applicantName: 'Jane Doe' },
      } as any;

      await processor.handleNotifyRecruiter(job);
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });
});
