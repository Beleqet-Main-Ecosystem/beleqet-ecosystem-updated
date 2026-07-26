import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuditLogModule } from '../audit-log.module';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuditLogController (Integration)', () => {
  let app: INestApplication;
  const mockPrismaService = {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuditLogModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/audit-logs should return paginated logs', async () => {
    const sampleLogs = [
      { id: 'log-1', action: 'CREATE', entity: 'Job', timestamp: new Date() },
      { id: 'log-2', action: 'UPDATE', entity: 'User', timestamp: new Date() },
    ];
    mockPrismaService.auditLog.findMany.mockResolvedValue(sampleLogs);
    mockPrismaService.auditLog.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?page=1&limit=10')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveLength(2);
    expect(response.body.total).toBe(2);
    expect(response.body.totalPages).toBe(1);
  });

  it('GET /api/v1/audit-logs/search should filter by parameters', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([
      { id: 'log-1', userId: 'usr-77', action: 'CREATE_JOB', entity: 'JOB' },
    ]);
    mockPrismaService.auditLog.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/api/v1/audit-logs/search?userId=usr-77&action=CREATE_JOB&entity=JOB')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe('usr-77');
  });

  it('DELETE /api/v1/audit-logs/retention should trigger data retention cleanup', async () => {
    mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 5 });

    const response = await request(app.getHttpServer())
      .delete('/api/v1/audit-logs/retention?days=60')
      .expect(200);

    expect(response.body).toHaveProperty('count', 5);
    expect(response.body).toHaveProperty('retentionDays', 60);
  });
});
