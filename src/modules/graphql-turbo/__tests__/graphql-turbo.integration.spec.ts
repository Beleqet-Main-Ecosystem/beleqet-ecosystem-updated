import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as net from 'net';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

async function isTcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function getUrlHostAndPort(rawUrl: string): { host: string; port: number } {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port || 5432),
    };
  } catch {
    return { host: '127.0.0.1', port: 5432 };
  }
}

/**
 * Integration test for the GraphQL Turbo module.
 *
 * Tests the full GraphQL endpoint including schema introspection,
 * query execution, and error handling.
 *
 * @remarks These tests require a running PostgreSQL and Redis instance.
 * Run with: npm run test:e2e -- --testPathPattern="graphql-turbo.integration"
 */
describe('GraphQL Turbo (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseUrl =
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/beleqet_test';
    const { host: databaseHost, port: databasePort } = getUrlHostAndPort(databaseUrl);
    const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
    const redisPort = Number(process.env.REDIS_PORT ?? 6379);

    const hasDatabase = await isTcpReachable(databaseHost, databasePort);
    const hasRedis = await isTcpReachable(redisHost, redisPort);
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /graphql (introspection)', () => {
    it('should support schema introspection', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query IntrospectionQuery {
              __schema {
                queryType { name }
                mutationType { name }
                types {
                  name
                  kind
                }
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.__schema).toBeDefined();
      expect(response.body.data.__schema.queryType.name).toBe('Query');
    });
  });

  describe('POST /graphql - jobs query', () => {
    it('should return paginated jobs', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              jobs {
                jobs {
                  id
                  title
                  location
                  type
                  status
                }
                total
                page
                hasNextPage
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.jobs).toBeDefined();
      expect(response.body.data.jobs.page).toBe(1);
      expect(Array.isArray(response.body.data.jobs.jobs)).toBe(true);
    });

    it('should support filtered job search', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              jobs(filter: { search: "developer" }) {
                jobs { id title }
                total
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.jobs).toBeDefined();
    });
  });

  describe('POST /graphql - job query', () => {
    it('should return null for non-existent job', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              job(id: "00000000-0000-0000-0000-000000000000") {
                id
                title
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.job).toBeNull();
    });
  });

  describe('POST /graphql - gqlUser query', () => {
    it('should return null for non-existent user', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              gqlUser(id: "00000000-0000-0000-0000-000000000000") {
                id
                firstName
                lastName
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.gqlUser).toBeNull();
    });
  });

  describe('POST /graphql - applications query', () => {
    it('should return paginated applications', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              applications {
                applications {
                  id
                  status
                  createdAt
                }
                total
                page
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.applications).toBeDefined();
      expect(response.body.data.applications.page).toBe(1);
    });
  });

  describe('POST /graphql - analyticsSummary query', () => {
    it('should return analytics data', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query {
              analyticsSummary {
                totalUsers
                totalJobs
                totalApplications
                activeJobs
                totalCompanies
                averageApplicationsPerJob
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.analyticsSummary).toBeDefined();
      expect(typeof response.body.data.analyticsSummary.totalUsers).toBe('number');
    });
  });

  describe('POST /graphql - error handling', () => {
    it('should handle invalid queries gracefully', async () => {
      if (!app) {
        return;
      }

      const response = await request(app.getHttpServer()).post('/graphql').send({
        query: `{ nonExistentField }`,
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });
});
