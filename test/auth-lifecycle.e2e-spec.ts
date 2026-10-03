import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testSuffix = randomUUID().substring(0, 8);
  const employerEmail = `emp-${testSuffix}@example.com`;
  const freelancerEmail = `free-${testSuffix}@example.com`;
  const jobSeekerEmail = `seeker-${testSuffix}@example.com`;
  const testPassword = 'SecurePassword123!';

  let employerToken = '';
  let employerRefreshToken = '';
  const createdUserIds: string[] = [];

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
  }, 90000);

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({
          where: { id: { in: createdUserIds } },
        })
        .catch(() => {});
    }
    await app.close();
  });

  describe('User Registration (Journeys 1.1 - 1.4)', () => {
    it('1.1 should register an EMPLOYER successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: employerEmail,
          password: testPassword,
          firstName: 'Alice',
          lastName: 'Employer',
          role: 'EMPLOYER',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(employerEmail.toLowerCase());
      expect(res.body.user.role).toBe('EMPLOYER');
      createdUserIds.push(res.body.user.id);
    });

    it('1.2 should register a FREELANCER successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: freelancerEmail,
          password: testPassword,
          firstName: 'Bob',
          lastName: 'Freelancer',
          role: 'FREELANCER',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(freelancerEmail.toLowerCase());
      expect(res.body.user.role).toBe('FREELANCER');
      createdUserIds.push(res.body.user.id);
    });

    it('1.3 should register a JOB_SEEKER successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: jobSeekerEmail,
          password: testPassword,
          firstName: 'Charlie',
          lastName: 'Seeker',
          role: 'JOB_SEEKER',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(jobSeekerEmail.toLowerCase());
      expect(res.body.user.role).toBe('JOB_SEEKER');
      createdUserIds.push(res.body.user.id);
    });

    it('1.4 should reject registration with duplicate email (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: employerEmail,
          password: testPassword,
          firstName: 'Duplicate',
          lastName: 'User',
        })
        .expect(409);

      expect(res.body.message).toMatch(/already registered/i);
    });
  });

  describe('User Login & JWT Validation (Journeys 1.5 - 1.9)', () => {
    it('1.5 should login with valid credentials and return JWT tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: employerEmail,
          password: testPassword,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(employerEmail.toLowerCase());

      employerToken = res.body.accessToken;
      employerRefreshToken = res.body.refreshToken;
    });

    it('1.6 should reject login with invalid password (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: employerEmail,
          password: 'WrongPassword!',
        })
        .expect(401);
    });

    it('1.7 should access protected /auth/me with valid Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(res.body.email).toBe(employerEmail.toLowerCase());
      expect(res.body.role).toBe('EMPLOYER');
    });

    it('1.8 should rotate tokens via /auth/refresh', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: employerRefreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.accessToken).not.toBe(employerToken);

      // Verify new token works
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('1.9 should reject unauthenticated request to /auth/me (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
