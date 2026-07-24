import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { CurrentUserPayload } from '../src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserPreferencesController } from '../src/modules/admin/user-preferences/user-preferences.controller';
import { UserPreferencesRepository } from '../src/modules/admin/user-preferences/user-preferences.repository';
import { UserPreferencesService } from '../src/modules/admin/user-preferences/user-preferences.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestUser {
  id: string;
  email: string;
}

/** Exercises the secured HTTP API against the actual configured PostgreSQL database. */
describe('Performance Gauge theme API and PostgreSQL persistence', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: TestUser;

  const authenticatedUserGuard: CanActivate = {
    canActivate(context: ExecutionContext): boolean {
      const requestContext = context.switchToHttp().getRequest<{ user: CurrentUserPayload }>();
      requestContext.user = { userId: user.id, email: user.email, role: 'ADMIN' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [UserPreferencesController],
      providers: [UserPreferencesRepository, UserPreferencesService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticatedUserGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);
    user = await prisma.user.create({
      data: {
        email: `theme-e2e-${randomUUID()}@example.test`,
        firstName: 'Theme',
        lastName: 'Integration',
      },
      select: { id: true, email: true },
    });
  });

  afterAll(async () => {
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await app.close();
  });

  it('persists a PATCH request and returns the selected value from a subsequent GET request', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/user-preferences/theme')
      .send({ theme: 'DARK' })
      .expect(200)
      .expect({ theme: 'DARK' });

    await expect(prisma.userPreference.findUnique({ where: { userId: user.id } })).resolves.toMatchObject({
      theme: 'DARK',
    });

    await request(app.getHttpServer())
      .get('/api/v1/user-preferences/theme')
      .expect(200)
      .expect({ theme: 'DARK' });
  });
});
