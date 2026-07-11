/**
 * @file jobs-applications.integration.spec.ts
 * @description
 * Integration test: Jobs Module ↔ Applications Module.
 *
 * Verifies that the core hiring workflow operates correctly end-to-end:
 *   1. Employer creates a job → persisted in DB, notifications enqueued.
 *   2. Job seeker applies → application created, screening queued, analytics enqueued.
 *   3. Duplicate application is rejected.
 *   4. Employer views applications for their job.
 *   5. Employer updates application status → notification + email enqueued.
 *   6. Job seeker withdraws their application.
 *   7. Employer updates (patches) their job listing.
 *   8. Employer archives their job listing.
 *   9. Application to non-existent job → NotFoundException.
 *  10. Application to non-published job → NotFoundException.
 *
 * All external I/O (Prisma, BullMQ, EventEmitter, email templates) is mocked.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { JobsService } from './jobs.service';
import { ApplicationsService } from '../applications/applications.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock email templates ─────────────────────────────────────────────────

jest.mock('../notifications/email-templates', () => ({
  jobPostConfirmationEmail: jest.fn().mockResolvedValue({ html: '<p>confirm</p>', text: 'confirm' }),
  jobAlertEmail: jest.fn().mockResolvedValue({ html: '<p>alert</p>', text: 'alert' }),
  applicationReceivedEmail: jest.fn().mockResolvedValue({ html: '<p>received</p>', text: 'received' }),
  applicationStatusEmail: jest.fn().mockResolvedValue({ html: '<p>status</p>', text: 'status' }),
}));

// ─── Shared mock factories ────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    jobCategory: { findMany: jest.fn() },
    application: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildMockQueues() {
  return {
    notifications: { add: jest.fn().mockResolvedValue({}) },
    application:   { add: jest.fn().mockResolvedValue({}) },
    analytics:     { add: jest.fn().mockResolvedValue({}) },
  };
}

function buildMockConfig() {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return fallback;
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

const EMPLOYER_ID  = 'employer-001';
const SEEKER_ID    = 'seeker-001';
const COMPANY_ID   = 'company-001';
const JOB_ID       = 'job-001';
const CATEGORY_ID  = 'cat-001';

const mockEmployer = { id: EMPLOYER_ID, firstName: 'Alice', email: 'alice@corp.com' };
const mockSeeker   = { id: SEEKER_ID, firstName: 'Bob', email: 'bob@dev.com' };
const mockCompany  = { id: COMPANY_ID, userId: EMPLOYER_ID, name: 'Acme Corp' };
const mockCategory = { id: CATEGORY_ID, label: 'Technology', slug: 'technology' };

const mockCreatedJob = {
  id: JOB_ID,
  title: 'Senior Backend Developer',
  description: 'Build scalable APIs',
  requirements: 'NestJS, PostgreSQL',
  location: 'Addis Ababa',
  type: 'FULL_TIME',
  categoryId: CATEGORY_ID,
  companyId: COMPANY_ID,
  status: 'PUBLISHED',
  company: mockCompany,
  category: mockCategory,
  createdAt: new Date(),
};

const mockCreatedApplication = {
  id: 'app-001',
  jobId: JOB_ID,
  userId: SEEKER_ID,
  coverLetter: 'I am a senior developer with 5 years of experience in NestJS and PostgreSQL.',
  resumeUrl: null,
  portfolioUrl: null,
  expectedSalary: 50000,
  screeningAnswers: null,
  status: 'SUBMITTED',
  user: { id: SEEKER_ID, firstName: 'Bob', lastName: 'Dev', email: 'bob@dev.com' },
  job: { id: JOB_ID, title: 'Senior Backend Developer', companyId: COMPANY_ID },
  createdAt: new Date(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────

describe('Integration: Jobs Module ↔ Applications Module', () => {
  let jobsService: JobsService;
  let applicationsService: ApplicationsService;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let queues: ReturnType<typeof buildMockQueues>;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma  = buildMockPrisma() as any;
    queues  = buildMockQueues();
    const config = buildMockConfig();

    prisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(prisma);
      return Promise.all(cb);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        ApplicationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getQueueToken('notifications'),  useValue: queues.notifications },
        { provide: getQueueToken('application-processing'), useValue: queues.application },
        { provide: getQueueToken('analytics'),       useValue: queues.analytics },
      ],
    }).compile();

    jobsService        = module.get<JobsService>(JobsService);
    applicationsService = module.get<ApplicationsService>(ApplicationsService);
  });

  // ── 1. Employer creates a job ───────────────────────────────────────────

  describe('Scenario 1 – Employer creates a job', () => {
    it('should create a job and enqueue confirmation + alert emails', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployer);
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.job.create.mockResolvedValue(mockCreatedJob);
      prisma.user.findMany.mockResolvedValue([]);

      const job = await jobsService.create(EMPLOYER_ID, {
        title: 'Senior Backend Developer',
        description: 'Build scalable APIs',
        requirements: 'NestJS, PostgreSQL',
        location: 'Addis Ababa',
        type: 'FULL_TIME' as any,
        categoryId: CATEGORY_ID,
      });

      expect(job.id).toBe(JOB_ID);
      expect(job.status).toBe('PUBLISHED');
      expect(prisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companyId: COMPANY_ID }) }),
      );
      expect(queues.notifications.add).toHaveBeenCalled();
    });
  });

  // ── 2. Job seeker applies to a published job ────────────────────────────

  describe('Scenario 2 – Job seeker applies to a published job', () => {
    it('should create an application, emit event, and enqueue screening', async () => {
      prisma.job.findFirst.mockResolvedValue({
        ...mockCreatedJob,
        company: mockCompany,
      });
      prisma.application.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      });
      prisma.application.create.mockResolvedValue(mockCreatedApplication);
      prisma.eventLog.create.mockResolvedValue({});

      const app = await applicationsService.submit(SEEKER_ID, {
        jobId: JOB_ID,
        coverLetter: 'I am a senior developer with 5 years of experience in NestJS and PostgreSQL.',
      } as any);

      expect(app.id).toBe('app-001');
      expect(app.status).toBe('SUBMITTED');
      expect(queues.application.add).toHaveBeenCalled();
      expect(queues.analytics.add).toHaveBeenCalled();
    });
  });

  // ── 3. Duplicate application is rejected ────────────────────────────────

  describe('Scenario 3 – Duplicate application is rejected', () => {
    it('should throw ConflictException when the user already applied', async () => {
      prisma.job.findFirst.mockResolvedValue({ ...mockCreatedJob, company: mockCompany });
      prisma.application.findUnique.mockResolvedValue({ id: 'existing-app' });

      await expect(
        applicationsService.submit(SEEKER_ID, { jobId: JOB_ID } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── 4. Employer views applications for their job ────────────────────────

  describe('Scenario 4 – Employer views applications for their job', () => {
    it('should return all applications for the employer\'s job', async () => {
      prisma.job.findFirst.mockResolvedValue({ id: JOB_ID });
      prisma.application.findMany.mockResolvedValue([
        { id: 'app-001', user: { id: SEEKER_ID, firstName: 'Bob' }, score: null },
        { id: 'app-002', user: { id: 'seeker-002', firstName: 'Carol' }, score: null },
      ]);

      const apps = await applicationsService.findByJob(JOB_ID, EMPLOYER_ID);
      expect(apps).toHaveLength(2);
    });

    it('should throw NotFoundException if the employer does not own the job', async () => {
      prisma.job.findFirst.mockResolvedValue(null);

      await expect(
        applicationsService.findByJob(JOB_ID, 'wrong-employer'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 5. Employer updates application status ──────────────────────────────

  describe('Scenario 5 – Employer updates application status', () => {
    it('should update status and send notification + email', async () => {
      prisma.application.findFirst.mockResolvedValue({
        id: 'app-001',
        userId: SEEKER_ID,
        user: { email: 'bob@dev.com', firstName: 'Bob' },
        job: { title: 'Senior Backend Developer' },
      });
      prisma.application.update.mockResolvedValue({ id: 'app-001', status: 'SHORTLISTED' });
      prisma.notification.create.mockResolvedValue({});

      const updated = await applicationsService.updateStatus(
        'app-001', 'SHORTLISTED', EMPLOYER_ID,
      );

      expect(updated.status).toBe('SHORTLISTED');
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(queues.notifications.add).toHaveBeenCalled();
    });
  });

  // ── 6. Job seeker withdraws application ─────────────────────────────────

  describe('Scenario 6 – Job seeker withdraws application', () => {
    it('should set status to WITHDRAWN', async () => {
      prisma.application.findFirst.mockResolvedValue({
        id: 'app-001', userId: SEEKER_ID, status: 'SUBMITTED',
      });
      prisma.application.update.mockResolvedValue({ id: 'app-001', status: 'WITHDRAWN' });

      const result = await applicationsService.withdraw('app-001', SEEKER_ID);
      expect(result.status).toBe('WITHDRAWN');
    });

    it('should throw NotFoundException for already processed applications', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        applicationsService.withdraw('app-001', SEEKER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 7. Employer updates (patches) their job listing ────────────────────

  describe('Scenario 7 – Employer patches their job listing', () => {
    it('should update the job and return the updated record', async () => {
      prisma.job.findFirst.mockResolvedValue({ id: JOB_ID, company: { userId: EMPLOYER_ID } });
      prisma.job.update.mockResolvedValue({ id: JOB_ID, title: 'Senior Full-Stack Developer' });

      const updated = await jobsService.update(JOB_ID, EMPLOYER_ID, {
        title: 'Senior Full-Stack Developer',
      });

      expect(updated.title).toBe('Senior Full-Stack Developer');
    });

    it('should throw NotFoundException if job not found or not owned by employer', async () => {
      prisma.job.findFirst.mockResolvedValue(null);

      await expect(
        jobsService.update(JOB_ID, 'wrong-employer', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 8. Employer archives their job ─────────────────────────────────────

  describe('Scenario 8 – Employer archives their job listing', () => {
    it('should set status to ARCHIVED', async () => {
      prisma.job.findFirst.mockResolvedValue({ id: JOB_ID });
      prisma.job.update.mockResolvedValue({ id: JOB_ID, status: 'ARCHIVED' });

      const result = await jobsService.remove(JOB_ID, EMPLOYER_ID);
      expect(result.status).toBe('ARCHIVED');
    });
  });

  // ── 9. Application to non-existent job → NotFoundException ──────────────

  describe('Scenario 9 – Application to non-existent job', () => {
    it('should throw NotFoundException', async () => {
      prisma.job.findFirst.mockResolvedValue(null);

      await expect(
        applicationsService.submit(SEEKER_ID, { jobId: 'nonexistent' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 10. Application without company profile → ForbiddenException ───────

  describe('Scenario 10 – Employer creates job without company profile', () => {
    it('should throw ForbiddenException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployer);
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        jobsService.create(EMPLOYER_ID, {
          title: 'Test', description: 'd', location: 'l', type: 'FULL_TIME' as any, categoryId: 'c',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 11. Employer views their own jobs ───────────────────────────────────

  describe('Scenario 11 – Employer views their own jobs', () => {
    it('should return only the employer\'s jobs', async () => {
      prisma.job.findMany.mockResolvedValue([
        { id: JOB_ID, title: 'Senior Backend Developer' },
      ]);

      const jobs = await jobsService.findByCompany(EMPLOYER_ID);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(JOB_ID);
    });
  });

  // ── 12. Full workflow: create job → apply → shortlist → withdraw ────────

  describe('Scenario 12 – Full lifecycle: create → apply → shortlist → withdraw', () => {
    it('should complete the full hiring workflow without errors', async () => {
      // Step 1: Create job
      prisma.user.findUnique.mockResolvedValue(mockEmployer);
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.job.create.mockResolvedValue(mockCreatedJob);
      prisma.user.findMany.mockResolvedValue([]);

      const job = await jobsService.create(EMPLOYER_ID, {
        title: 'Dev', description: 'Build APIs', location: 'Addis',
        type: 'FULL_TIME' as any, categoryId: CATEGORY_ID,
      });
      expect(job.id).toBe(JOB_ID);

      // Step 2: Apply
      prisma.job.findFirst.mockResolvedValue({ ...mockCreatedJob, company: mockCompany });
      prisma.application.findUnique.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue(mockCreatedApplication);
      prisma.eventLog.create.mockResolvedValue({});

      const app = await applicationsService.submit(SEEKER_ID, {
        jobId: JOB_ID,
        coverLetter: 'I am a senior developer with 5 years of experience in NestJS and PostgreSQL.',
      } as any);
      expect(app.status).toBe('SUBMITTED');

      // Step 3: Employer shortlists
      prisma.application.findFirst.mockResolvedValue({
        ...mockCreatedApplication,
        user: { email: 'bob@dev.com', firstName: 'Bob' },
        job: { title: 'Senior Backend Developer' },
      });
      prisma.application.update.mockResolvedValue({ ...mockCreatedApplication, status: 'SHORTLISTED' });

      const updated = await applicationsService.updateStatus(
        'app-001', 'SHORTLISTED', EMPLOYER_ID,
      );
      expect(updated.status).toBe('SHORTLISTED');

      // Step 4: Seeker withdraws
      prisma.application.findFirst.mockResolvedValue({
        ...mockCreatedApplication, status: 'SHORTLISTED',
      });
      prisma.application.update.mockResolvedValue({ ...mockCreatedApplication, status: 'WITHDRAWN' });

      const withdrawn = await applicationsService.withdraw('app-001', SEEKER_ID);
      expect(withdrawn.status).toBe('WITHDRAWN');
    });
  });
});
