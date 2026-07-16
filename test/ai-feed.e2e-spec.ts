import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AiFeedModule } from '../src/modules/ai-feed/ai-feed.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

/**
 * Integration test for `GET /ai-feed`.
 *
 * Unlike `ai-feed.service.spec.ts` (unit test, service logic in isolation),
 * this test boots a real Nest application and exercises the full HTTP
 * request pipeline for the module: routing, the global `ValidationPipe`
 * (mirroring `main.ts`), `JwtAuthGuard`, `AiFeedController`, and
 * `AiFeedService` together, via real HTTP requests (`supertest`).
 *
 * `PrismaService` is still mocked (no live test database is wired up for
 * this module), and `JwtAuthGuard` is overridden to simulate an
 * authenticated request without depending on the `auth` module's JWT
 * secret/strategy setup, which is out of scope for this module's tests.
 */
describe('AiFeed (e2e)', () => {
  let app: INestApplication;

  const mockUser = { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' };

  const mockJobs = [
    {
      id: '1',
      title: 'React Developer',
      description: 'Build UI with React',
      status: 'PUBLISHED',
      currency: 'USD',
      salaryMin: 1000,
      salaryMax: 2000,
      tags: ['react'],
      categoryId: 'cat-frontend',
      createdAt: new Date('2026-01-02'),
      company: null,
      category: null,
    },
  ];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ gdprConsent: true, skills: [] }),
    },
    searchHistory: {
      findMany: jest.fn().mockResolvedValue([{ searchTerm: 'React' }]),
    },
    savedJob: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    job: {
      findMany: jest.fn().mockResolvedValue(mockJobs),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AiFeedModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      // Simulate an authenticated request without depending on a real JWT
      // secret/strategy: the `auth` module's login/token flow has its own
      // dedicated tests and is out of scope here.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirrors the global pipe registered in `main.ts` so DTO validation is
    // exercised the same way it is in production.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockPrismaService.user.findUnique.mockResolvedValue({ gdprConsent: true, skills: [] });
    mockPrismaService.searchHistory.findMany.mockResolvedValue([{ searchTerm: 'React' }]);
    mockPrismaService.savedJob.findMany.mockResolvedValue([]);
    mockPrismaService.job.findMany.mockResolvedValue(mockJobs);
  });

  it('GET /ai-feed returns a personalized, ranked feed for the authenticated user', async () => {
    const response = await request(app.getHttpServer()).get('/ai-feed?limit=5').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toHaveProperty('relevanceScore');
    expect(response.body[0].id).toBe('1');
  });

  it('GET /ai-feed rejects limit values above the allowed maximum', async () => {
    await request(app.getHttpServer()).get('/ai-feed?limit=999').expect(400);
  });

  it('GET /ai-feed rejects a non-numeric limit', async () => {
    await request(app.getHttpServer()).get('/ai-feed?limit=abc').expect(400);
  });

  it('GET /ai-feed defaults to a generic feed when the user has no GDPR consent', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({ gdprConsent: false, skills: [] });

    const response = await request(app.getHttpServer()).get('/ai-feed').expect(200);

    expect(response.body.every((job: { relevanceScore: number }) => job.relevanceScore === 0)).toBe(
      true,
    );
    expect(mockPrismaService.searchHistory.findMany).not.toHaveBeenCalled();
  });
});