import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { AuditLoggingService } from './audit-logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

type EventLogRow = Record<string, unknown>;

/**
 * Integration-style suite for audit logging create + filter/search flows.
 * Uses an in-memory Prisma mock so CI does not require a live Postgres instance.
 */
describe('AuditLoggingService Integration', () => {
  let service: AuditLoggingService;
  const store: EventLogRow[] = [];

  const findManyImpl = async ({
    where,
  }: {
    where?: Record<string, unknown>;
  }): Promise<EventLogRow[]> => {
    if (!where || !where.AND) {
      return [...store];
    }
    const clauses = where.AND as Array<Record<string, unknown>>;
    return store.filter((row) =>
      clauses.every((clause) => {
        if (clause.eventType) {
          return row.eventType === clause.eventType;
        }
        if (clause.httpMethod) {
          return row.httpMethod === clause.httpMethod;
        }
        if (clause.OR) {
          const or = clause.OR as Array<Record<string, unknown>>;
          return or.some((part) => {
            const pathFilter = part.path as { contains?: string } | undefined;
            const eventFilter = part.eventType as { contains?: string } | undefined;
            const entityFilter = part.entityId as { contains?: string } | undefined;
            const term =
              pathFilter?.contains || eventFilter?.contains || entityFilter?.contains || '';
            return (
              String(row.path || '')
                .toLowerCase()
                .includes(term.toLowerCase()) ||
              String(row.eventType || '')
                .toLowerCase()
                .includes(term.toLowerCase()) ||
              String(row.entityId || '')
                .toLowerCase()
                .includes(term.toLowerCase())
            );
          });
        }
        return true;
      }),
    );
  };

  const prismaMock = {
    eventLog: {
      create: jest.fn(
        async ({ data }: { data: Record<string, unknown> }): Promise<EventLogRow> => {
          const row: EventLogRow = {
            id: `evt-${store.length + 1}`,
            createdAt: new Date('2026-07-26T12:00:00.000Z'),
            processedBy: null,
            actorUserId: null,
            ipAddress: null,
            httpMethod: null,
            path: null,
            statusCode: null,
            durationMs: null,
            ...data,
          };
          store.push(row);
          return row;
        },
      ),
      findMany: jest.fn(findManyImpl),
      count: jest.fn(
        async ({ where }: { where?: Record<string, unknown> }): Promise<number> => {
          const rows: EventLogRow[] = await findManyImpl({ where });
          return rows.length;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }): Promise<EventLogRow | null> =>
          store.find((row) => row.id === where.id) || null,
      ),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: I18nService,
          useValue: {
            t: (_key: string, opts: { defaultValue: string }) => opts.defaultValue,
          },
        },
        {
          provide: WalletService,
          useValue: {
            convertCurrency: (amount: number) => amount,
          },
        },
      ],
    }).compile();

    service = moduleFixture.get(AuditLoggingService);
  });

  beforeEach(() => {
    store.length = 0;
    jest.clearAllMocks();
  });

  it('creates then lists and searches audit logs end-to-end', async () => {
    await service.create({
      eventType: 'HTTP_REQUEST',
      entityId: 'user-a',
      entityType: 'HttpRequest',
      httpMethod: 'GET',
      path: '/api/v1/jobs',
      statusCode: 200,
      durationMs: 15,
      payload: { amount: 10, currency: 'ETB' },
    });

    await service.create({
      eventType: 'AccountLinkSucceeded',
      entityId: 'user-b',
      entityType: 'User',
      payload: { provider: 'google' },
    });

    const listed = await service.findMany({
      eventType: 'HTTP_REQUEST',
      search: 'jobs',
      page: 1,
      limit: 10,
      currency: 'ETB',
      lang: 'en',
    });

    expect(listed.meta.total).toBe(1);
    expect(listed.data[0].path).toBe('/api/v1/jobs');
    expect(listed.data[0].amountInDisplayCurrency).toBe(10);

    const byId = await service.findById(String(listed.data[0].id));
    expect(byId.eventType).toBe('HTTP_REQUEST');
  });

  it('exports filtered JSON for GDPR-oriented downloads', async () => {
    await service.create({
      eventType: 'HTTP_REQUEST',
      entityId: 'user-export',
      entityType: 'HttpRequest',
      path: '/api/v1/wallet',
      payload: {},
    });

    const exported = await service.export({
      search: 'wallet',
      format: 'json',
      lang: 'en',
    });

    expect(exported.contentType).toContain('application/json');
    const parsed = JSON.parse(exported.body) as { data: Array<{ path: string }> };
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].path).toBe('/api/v1/wallet');
  });
});
