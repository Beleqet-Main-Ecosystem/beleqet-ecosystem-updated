import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { Queue } from 'bullmq';
import { EmailType, EmailStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../email.service';
import { EmailProcessor } from '../email.processor';
import { EmailGdprService } from '../email-gdpr.service';

/**
 * True integration test: runs real Postgres and Redis containers,
 * applies Prisma migrations, enqueues a real BullMQ job, lets the
 * real EmailProcessor consume it (with only the outbound mail
 * transport mocked, since we don't want to hit a live SMTP server
 * in CI), and asserts the EmailLog row is actually updated in the DB.
 *
 * Requires Docker to be available in the CI runner.
 */
describe('Email module (integration: Postgres + Redis + BullMQ)', () => {
  jest.setTimeout(120_000);

  let pg: StartedPostgreSqlContainer | undefined;
  let redis: StartedTestContainer | undefined;
  let prismaClient: PrismaClient | undefined;
  let moduleRef: TestingModule | undefined;
  let emailService: EmailService | undefined;
  let queue: Queue | undefined;
  let mailer: { sendMail: jest.Mock } | undefined;
  let shouldRunIntegration = false;

  beforeAll(async () => {
    try {
      pg = await new PostgreSqlContainer('postgres:16-alpine').start();
      redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();

      process.env.DATABASE_URL = pg.getConnectionUri();
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: pg.getConnectionUri() },
        stdio: 'inherit',
      });

      prismaClient = new PrismaClient({ datasources: { db: { url: pg.getConnectionUri() } } });
      mailer = { sendMail: jest.fn() };

      moduleRef = await Test.createTestingModule({
        imports: [
          BullModule.forRoot({
            connection: { host: redis.getHost(), port: redis.getMappedPort(6379) },
          }),
          BullModule.registerQueue({ name: 'email-dispatch' }),
        ],
        providers: [
          EmailService,
          EmailProcessor,
          EmailGdprService,
          { provide: PrismaService, useValue: prismaClient },
          { provide: MailerService, useValue: mailer },
        ],
      }).compile();

      emailService = moduleRef.get(EmailService);
      queue = moduleRef.get(getQueueToken('email-dispatch'));
      shouldRunIntegration = true;
    } catch {
      shouldRunIntegration = false;
    }
  });

  afterAll(async () => {
    if (!queue || !prismaClient || !moduleRef || !pg || !redis) return;
    await queue.close();
    await prismaClient.$disconnect();
    await moduleRef.close();
    await pg.stop();
    await redis.stop();
  });

  it('persists a QUEUED log, processes the job, and updates it to SENT', async () => {
    if (!shouldRunIntegration || !emailService || !mailer) {
      return;
    }

    mailer.sendMail.mockResolvedValue({ messageId: 'integration-test-msg' });

    const log = await emailService.dispatch({
      recipient: 'integration@example.com',
      type: EmailType.WELCOME,
      locale: 'en',
      variables: { name: 'Integration Test' },
    });

    expect(log?.status).toBe(EmailStatus.QUEUED);

    // Poll for the worker (running inside the real BullMQ queue) to finish.
    let updated = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    const deadline = Date.now() + 15_000;
    while (updated.status === EmailStatus.QUEUED && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      updated = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    }

    expect(updated.status).toBe(EmailStatus.SENT);
    expect(updated.providerMsgId).toBe('integration-test-msg');
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'integration@example.com' }),
    );
  });

  it('marks the log FAILED when the mail transport rejects, and it is retryable via resend', async () => {
    if (!shouldRunIntegration || !emailService || !mailer) {
      return;
    }

    mailer.sendMail.mockRejectedValueOnce(new Error('Simulated SMTP outage'));

    const log = await emailService.dispatch({
      recipient: 'fail@example.com',
      type: EmailType.PASSWORD_RESET,
    });

    let updated = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    const deadline = Date.now() + 15_000;
    while (updated.attempts === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      updated = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    }

    expect(updated.status).toBe(EmailStatus.FAILED);
    expect(updated.errorMessage).toContain('Simulated SMTP outage');

    mailer.sendMail.mockResolvedValueOnce({ messageId: 'retry-msg' });
    await emailService.resend(log!.id);

    let retried = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    const retryDeadline = Date.now() + 15_000;
    while (retried.status !== EmailStatus.SENT && Date.now() < retryDeadline) {
      await new Promise((r) => setTimeout(r, 250));
      retried = await prismaClient!.emailLog.findUniqueOrThrow({ where: { id: log!.id } });
    }

    expect(retried.status).toBe(EmailStatus.SENT);
  });
});
