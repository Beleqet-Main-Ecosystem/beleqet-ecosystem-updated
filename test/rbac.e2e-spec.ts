import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RbacModule (e2e)', () => {
  let app: INestApplication;

  // Create mock objects
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
  };

  // State to toggle what our mocked AuthGuard returns
  let mockAuthenticatedUser: { id: string; role: string } | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!mockAuthenticatedUser) throw new UnauthorizedException();
          const req = context.switchToHttp().getRequest();
          req.user = mockAuthenticatedUser;
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser = null;
  });

  it('/admin/rbac/roles (GET) - Should return 401 if unauthenticated', async () => {
    return request(app.getHttpServer()).get('/admin/rbac/roles').expect(401);
  });

  it('/admin/rbac/roles (GET) - Should return 403 Forbidden for unauthorized EMPLOYER role', async () => {
    // Authenticate as employer
    mockAuthenticatedUser = { id: 'employer-user-id', role: 'EMPLOYER' };

    // Mock Prisma to return employer with ONLY 'create:jobs' permission
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'employer-user-id',
      rbacRoles: [
        {
          permissions: [{ action: 'create:jobs' }],
        },
      ],
    });

    return request(app.getHttpServer()).get('/admin/rbac/roles').expect(403);
  });

  it('/admin/rbac/roles (GET) - Should return 200 OK for authorized ADMIN role', async () => {
    // Authenticate as admin
    mockAuthenticatedUser = { id: 'admin-user-id', role: 'ADMIN' };

    // Mock Prisma to return admin WITH 'manage:roles' permission required by this endpoint
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'admin-user-id',
      rbacRoles: [
        {
          permissions: [{ action: 'manage:roles' }],
        },
      ],
    });

    // Mock the actual DB call for getRoles
    mockPrismaService.role.findMany.mockResolvedValue([]);

    return request(app.getHttpServer()).get('/admin/rbac/roles').expect(200).expect([]);
  });
});
