import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { createHmac, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
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
  let employerTicket = '';
  let codeSecret = '';

  /** How the API stores a code: a keyed hash, scoped to the account (AuthService.emailCodeKey). */
  const codeKey = (userId: string, code: string) =>
    `evc:${userId}:${createHmac('sha256', codeSecret).update(`${userId}:${code}`).digest('hex')}`;

  /** Sign-up answers with a code ticket, not a session; returns the new account's id. */
  async function expectCodeChallenge(body: any, email: string, role: string) {
    expect(body.requiresEmailVerification).toBe(true);
    expect(typeof body.verificationToken).toBe('string');
    expect(body.email).toBe(email.toLowerCase());
    expect(body).not.toHaveProperty('accessToken');
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(user?.role).toBe(role);
    expect(user?.emailVerified).toBe(false);
    createdUserIds.push(user!.id);
    return user!.id;
  }

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
    const config = moduleFixture.get(ConfigService);
    codeSecret =
      config.get<string>('TOTP_TEMP_SECRET') ?? config.get<string>('JWT_ACCESS_SECRET') ?? '';
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

      await expectCodeChallenge(res.body, employerEmail, 'EMPLOYER');
      employerTicket = res.body.verificationToken;
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

      await expectCodeChallenge(res.body, freelancerEmail, 'FREELANCER');
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

      await expectCodeChallenge(res.body, jobSeekerEmail, 'JOB_SEEKER');
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

  describe('Email confirmation with a code (Journeys 1.4b - 1.4e)', () => {
    it('1.4b signing in before confirming asks for the code instead of a session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: employerEmail, password: testPassword })
        .expect(200);
      expect(res.body.requiresEmailVerification).toBe(true);
      expect(res.body).not.toHaveProperty('accessToken');
      employerTicket = res.body.verificationToken;
    });

    it('1.4c a wrong code is refused (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email-code')
        .send({ verificationToken: employerTicket, code: '000000' })
        .expect(400);
      expect(res.body.message).toMatch(/not right or has expired/i);
    });

    it('1.4d the right code confirms the email and signs the account in', async () => {
      // The test cannot read the email, so it replaces the code with a known one, stored the way the API stores codes.
      const employer = await prisma.user.findUniqueOrThrow({
        where: { email: employerEmail.toLowerCase() },
      });
      await prisma.verificationToken.deleteMany({ where: { userId: employer.id } });
      await prisma.verificationToken.create({
        data: {
          userId: employer.id,
          token: codeKey(employer.id, '246810'),
          type: 'EMAIL_VERIFICATION_CODE',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email-code')
        .send({ verificationToken: employerTicket, code: '246 810' })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(employerEmail.toLowerCase());
      const after = await prisma.user.findUniqueOrThrow({ where: { id: employer.id } });
      expect(after.emailVerified).toBe(true);
    });

    it('1.4e a forged code ticket is refused (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email-code')
        .send({ verificationToken: 'not-a-ticket', code: '123456' })
        .expect(400);
      // The other two accounts are confirmed directly; the later journeys sign in with them.
      await prisma.user.updateMany({
        where: { email: { in: [freelancerEmail.toLowerCase(), jobSeekerEmail.toLowerCase()] } },
        data: { emailVerified: true },
      });
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
      // Delay 1000ms so JWT timestamp (iat) increments, ensuring new access token
      await new Promise((r) => setTimeout(r, 1000));

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: employerRefreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(employerRefreshToken);
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
