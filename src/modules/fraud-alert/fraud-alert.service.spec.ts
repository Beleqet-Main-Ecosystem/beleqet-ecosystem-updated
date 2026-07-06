import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';
import { FraudAlertService } from './fraud-alert.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

const mockTx = {
  fraudAlert: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  eventLog: { create: jest.fn() },
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  fraudRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  fraudAlert: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  eventLog: {
    create: jest.fn(),
  },
  message: {
    findUnique: jest.fn(),
  },
  freelancerWallet: {
    findUnique: jest.fn(),
  },
  job: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};

const mockEventEmitter = { emit: jest.fn() };
const mockNotificationsQueue = { add: jest.fn().mockResolvedValue(undefined) };

describe('FraudAlertService', () => {
  let service: FraudAlertService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudAlertService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockNotificationsQueue },
      ],
    }).compile();

    service = module.get<FraudAlertService>(FraudAlertService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectOffPlatformPayment', () => {
    it('should flag messages containing PayPal references', () => {
      const result = service.detectOffPlatformPayment(
        'Please send the payment via PayPal to my account',
      );
      expect(result.matches).toContain('PayPal');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should flag messages with bank transfer keywords', () => {
      const result = service.detectOffPlatformPayment(
        'I prefer bank transfer for this job, my account number is 1000123456',
      );
      expect(result.matches).toContain('Bank transfer');
    });

    it('should flag messages with Ethiopian payment apps', () => {
      const result = service.detectOffPlatformPayment(
        'Use Telebirr to pay me directly, it is fast',
      );
      expect(result.matches).toContain('Telebirr');
    });

    it('should flag Amharic-language off-platform payment terms', () => {
      const result = service.detectOffPlatformPayment(
        'እባክዎ በቀጥታ ክፈሉ ወደ ቴሌግራም ላክ',
      );
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should return zero score for clean messages', () => {
      const result = service.detectOffPlatformPayment(
        'Hello, I am interested in your job posting. Can we discuss the requirements?',
      );
      expect(result.score).toBe(0);
      expect(result.matches).toEqual([]);
    });

    it('should detect phone numbers', () => {
      const result = service.detectOffPlatformPayment(
        'Call me at 0911345678 for more details',
      );
      expect(result.matches).toContain('Ethiopian phone number');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('detectFakeProfile', () => {
    it('should flag user with no email verification + many skills', () => {
      const user = {
        emailVerified: false,
        skillVerified: false,
        skills: Array(10).fill('JavaScript'),
        company: null,
      };
      const result = service.detectFakeProfile(user);
      expect(result.score).toBeGreaterThan(30);
      expect(result.flags).toContain('many_skills_no_verification');
    });

    it('should pass verified user with few skills', () => {
      const user = {
        emailVerified: true,
        skillVerified: true,
        skills: ['JavaScript', 'TypeScript'],
        company: { verified: true },
      };
      const result = service.detectFakeProfile(user);
      expect(result.score).toBe(0);
    });

    it('should flag excessive unverified skills', () => {
      const user = {
        emailVerified: true,
        skillVerified: false,
        skills: Array(20).fill('React'),
        company: { verified: true },
      };
      const result = service.detectFakeProfile(user);
      expect(result.flags).toContain('EXCESSIVE_UNVERIFIED_SKILLS');
    });

    it('should flag low CandidateScore with many skill claims', () => {
      const user = {
        emailVerified: true,
        skillVerified: true,
        skills: ['Python', 'Django', 'Flask', 'FastAPI', 'SQL', 'Docker'],
        company: { verified: true },
      };
      const candidateScores = [
        { overallScore: 20, skillScore: 15 },
      ];
      const result = service.detectFakeProfile(user, candidateScores);
      expect(result.flags).toContain('low_scores_high_claim');
    });
  });

  describe('detectPaymentAnomaly', () => {
    it('should flag high-velocity transactions in 24h', () => {
      const now = new Date();
      const transactions = Array(25).fill(null).map((_, i) => ({
        type: i % 5 === 0 ? 'DEBIT_FEE' : 'CREDIT_PENDING',
        amount: 500 * (i + 1),
        createdAt: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(),
      }));
      const result = service.detectPaymentAnomaly(transactions);
      expect(result.flags).toContain('high_velocity_24h');
    });

    it('should detect repeated round-number amounts', () => {
      const now = new Date();
      const transactions = Array(8).fill(null).map((_, i) => ({
        type: 'CREDIT_AVAILABLE',
        amount: 10000,
        createdAt: new Date(now.getTime() - i * 2 * 60 * 60 * 1000).toISOString(),
      }));
      const result = service.detectPaymentAnomaly(transactions);
      expect(result.flags).toContain('repeated_round_amounts');
    });

    it('should pass normal transaction patterns', () => {
      const now = new Date();
      const transactions = [
        { type: 'CREDIT_PENDING', amount: 1500, createdAt: new Date(now.getTime() - 1 * 3600000).toISOString() },
        { type: 'CREDIT_AVAILABLE', amount: 1500, createdAt: new Date(now.getTime() - 2 * 3600000).toISOString() },
        { type: 'DEBIT_WITHDRAWAL', amount: 1500, createdAt: new Date(now.getTime() - 3 * 3600000).toISOString() },
      ];
      const result = service.detectPaymentAnomaly(transactions);
      expect(result.score).toBe(0);
    });
  });

  describe('detectDuplicateListing', () => {
    it('should detect near-identical job descriptions', () => {
      const job = {
        id: 'job-1',
        description: 'Build and maintain fintech applications using Node.js and React',
        companyId: 'company-a',
      };
      const existing = [
        {
          id: 'job-2',
          title: 'Full Stack Dev',
          description: 'Build and maintain fintech applications using Node.js and React',
        },
      ];
      const result = service.detectDuplicateListing(job, existing);
      expect(result.score).toBeGreaterThan(40);
      expect(result.matchIds).toContain('job-2');
    });

    it('should not flag genuinely distinct job descriptions', () => {
      const job = {
        id: 'job-1',
        description: 'Senior accountant for a trading company in Addis Ababa',
        companyId: 'company-a',
      };
      const existing = [
        {
          id: 'job-2',
          title: 'Software Engineer',
          description: 'Build full-stack web applications with React and PostgreSQL',
        },
      ];
      const result = service.detectDuplicateListing(job, existing);
      expect(result.score).toBe(0);
    });
  });

  describe('resolveAlert', () => {
    it('should update alert status and write event log', async () => {
      mockTx.fraudAlert.update.mockResolvedValue({ id: 'alert-1', status: 'RESOLVED' });
      mockTx.eventLog.create.mockResolvedValue({ id: 'log-1' });

      await service.resolveAlert('alert-1', 'RESOLVED', 'admin-1', 'Reviewed and resolved');

      expect(mockTx.fraudAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({ status: 'RESOLVED' }),
        }),
      );
      expect(mockTx.eventLog.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('fraud.alert.resolved', expect.any(Object));
    });
  });

  describe('createAlert', () => {
    it('should create alert and enqueue notifications', async () => {
      const txMock = {
        fraudAlert: { create: jest.fn().mockResolvedValue({ id: 'alert-new', status: 'OPEN' }) },
        eventLog: { create: jest.fn().mockResolvedValue({ id: 'log-new' }) },
      };
      mockPrismaService.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const result = await service.createAlert({
        entityType: 'User',
        entityId: 'user-1',
        userId: 'user-1',
        ruleId: 'rule-1',
        ruleType: 'FAKE_PROFILE',
        severity: 'HIGH',
        score: 75,
        reason: 'Fake profile detected',
      });

      expect(result.id).toBe('alert-new');
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('fraud.alert.created', expect.any(Object));
    });
  });
});
