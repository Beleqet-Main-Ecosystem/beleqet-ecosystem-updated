import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/modules/redis/redis.module';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Jobs & Applications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let authService: AuthService;

  const testSuffix = randomUUID().substring(0, 8);
  let employer: any;
  let candidate: any;
  let employerToken = '';
  let candidateToken = '';
  let categoryId = '';
  let createdJobId = '';
  let createdApplicationId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = moduleFixture.get(PrismaService);
    redis = moduleFixture.get(REDIS_CLIENT);
    authService = moduleFixture.get(AuthService);

    // Create test category if none exists
    let cat = await prisma.jobCategory.findFirst();
    if (!cat) {
      cat = await prisma.jobCategory.create({
        data: {
          label: `Tech-${testSuffix}`,
          slug: `tech-${testSuffix}`,
        },
      });
    }
    categoryId = cat.id;

    // Create permission and role for employer
    const perm = await prisma.permission.upsert({
      where: { action: 'create:jobs' },
      update: {},
      create: { action: 'create:jobs', description: 'Create job listings' },
    });
    const role = await prisma.role.upsert({
      where: { name: `EMP_ROLE_${testSuffix}` },
      update: { permissions: { connect: { id: perm.id } } },
      create: {
        name: `EMP_ROLE_${testSuffix}`,
        permissions: { connect: { id: perm.id } },
      },
    });

    // Create employer user
    employer = await prisma.user.create({
      data: {
        email: `employer-${testSuffix}@example.com`,
        firstName: 'Emp',
        lastName: 'Jobs',
        role: 'EMPLOYER',
        rbacRoles: { connect: { id: role.id } },
      },
    });

    // Create company profile for employer
    await prisma.company.create({
      data: {
        name: `Acme Corp ${testSuffix}`,
        userId: employer.id,
      },
    });

    // Seed permission in Redis for RolesGuard
    await redis.set(`user_permissions:${employer.id}`, JSON.stringify(['create:jobs']), 'EX', 3600);

    const empTokens: any = await authService.login(employer);
    employerToken = empTokens.accessToken;

    // Create candidate user
    candidate = await prisma.user.create({
      data: {
        email: `candidate-${testSuffix}@example.com`,
        firstName: 'Cand',
        lastName: 'Jobs',
        role: 'JOB_SEEKER',
      },
    });
    const candTokens: any = await authService.login(candidate);
    candidateToken = candTokens.accessToken;
  }, 90000);

  afterAll(async () => {
    try {
      if (candidate?.id) {
        await prisma.notification.deleteMany({ where: { userId: candidate.id } }).catch(() => {});
      }
      if (createdJobId) {
        await prisma.candidateScore
          .deleteMany({ where: { application: { jobId: createdJobId } } })
          .catch(() => {});
        await prisma.application.deleteMany({ where: { jobId: createdJobId } }).catch(() => {});
        await prisma.job.deleteMany({ where: { id: createdJobId } }).catch(() => {});
      }
      if (candidate?.id) {
        await prisma.user.deleteMany({ where: { id: candidate.id } }).catch(() => {});
      }
      if (employer?.id) {
        await prisma.company.deleteMany({ where: { userId: employer.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: employer.id } }).catch(() => {});
      }
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  describe('Job Search & Categories (Journeys 3.2, 3.3)', () => {
    it('3.3 should return job categories', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/jobs/categories').expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('3.2 should browse and search public jobs', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/jobs').expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
    });
  });

  describe('Employer Creates & Manages Job Listing (Journey 3.1)', () => {
    it('3.1 should allow authorized employer to create a job', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: `Senior Backend Engineer ${testSuffix}`,
          description:
            'Build robust scalable distributed microservices with NestJS and PostgreSQL.',
          location: 'Remote',
          type: 'REMOTE',
          categoryId: categoryId,
          salaryMin: 40000,
          salaryMax: 80000,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toContain('Senior Backend Engineer');
      expect(res.body).toHaveProperty('companyId');
      createdJobId = res.body.id;
    });

    it('should view single job details by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${createdJobId}`)
        .expect(200);

      expect(res.body.id).toBe(createdJobId);
      expect(res.body.categoryId).toBe(categoryId);
    });

    it('should return employer jobs via /jobs/my', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/jobs/my')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.some((j: any) => j.id === createdJobId)).toBeTruthy();
    });
  });

  describe('Candidate Submits & Manages Application (Journeys 3.4 - 3.7)', () => {
    it('3.4 should allow candidate to apply to the job', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          jobId: createdJobId,
          coverLetter:
            'I have extensive full-stack experience crafting high-throughput systems and APIs with TypeScript and NestJS.',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      createdApplicationId = res.body.id;
      expect(res.body.jobId).toBe(createdJobId);
      expect(res.body.userId).toBe(candidate.id);
      expect(res.body.status).toBe('SUBMITTED');
    });

    it('3.5 should prevent duplicate application to the same job (409 Conflict)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          jobId: createdJobId,
          coverLetter: 'Second attempt applying should be blocked by duplicate application guard.',
        })
        .expect(409);
    });

    it('3.6 should allow candidate to view submitted applications via /applications/my', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications/my')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.some((a: any) => a.id === createdApplicationId)).toBeTruthy();
    });

    it('3.6 should allow employer to view applications for their job', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/applications/job/${createdJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.some((a: any) => a.id === createdApplicationId)).toBeTruthy();
    });

    it('3.7 should allow employer to update application status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'SHORTLISTED' })
        .expect(200);

      expect(res.body.status).toBe('SHORTLISTED');
    });
  });
});
