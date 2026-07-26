import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailStatus, EmailType } from '@prisma/client';
import { EmailService } from '../email.service';
import { EmailGdprService } from '../email-gdpr.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: { emailLog: any; $transaction: jest.Mock };
  let queue: { add: jest.Mock };
  let gdprService: { isSuppressed: jest.Mock; buildUnsubscribeUrl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      emailLog: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    queue = { add: jest.fn() };
    gdprService = {
      isSuppressed: jest.fn().mockResolvedValue(false),
      buildUnsubscribeUrl: jest.fn().mockReturnValue('https://beleqet.com/email/unsubscribe?x'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailGdprService, useValue: gdprService },
        { provide: getQueueToken('email-dispatch'), useValue: queue },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  describe('dispatch', () => {
    it('creates a QUEUED log row and enqueues a send job', async () => {
      prisma.emailLog.create.mockResolvedValue({
        id: 'log-1',
        type: EmailType.WELCOME,
        status: EmailStatus.QUEUED,
      });

      const result = await service.dispatch({
        recipient: 'user@example.com',
        type: EmailType.WELCOME,
        locale: 'en',
        variables: { name: 'Tekalign' },
      });

      expect(prisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient: 'user@example.com',
            type: EmailType.WELCOME,
            status: EmailStatus.QUEUED,
            templateName: 'welcome',
          }),
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'send',
        { emailLogId: 'log-1' },
        expect.objectContaining({ attempts: 3 }),
      );
      expect(result?.id).toBe('log-1');
    });

    it('falls back to the default subject when no override is provided', async () => {
      prisma.emailLog.create.mockResolvedValue({ id: 'log-2' });

      await service.dispatch({
        recipient: 'a@b.com',
        type: EmailType.PASSWORD_RESET,
      });

      expect(prisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subject: 'Reset your password' }),
        }),
      );
    });

    it('skips suppressed recipients for NEWSLETTER without creating a log or queueing', async () => {
      gdprService.isSuppressed.mockResolvedValue(true);

      const result = await service.dispatch({
        recipient: 'unsubscribed@example.com',
        type: EmailType.NEWSLETTER,
      });

      expect(result).toBeNull();
      expect(prisma.emailLog.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('does not suppress transactional email types even if the recipient unsubscribed', async () => {
      gdprService.isSuppressed.mockResolvedValue(true);
      prisma.emailLog.create.mockResolvedValue({ id: 'log-3' });

      const result = await service.dispatch({
        recipient: 'unsubscribed@example.com',
        type: EmailType.PASSWORD_RESET,
      });

      expect(result).not.toBeNull();
      expect(prisma.emailLog.create).toHaveBeenCalled();
    });

    it('formats amount as locale-correct currency for PAYMENT_RECEIPT', async () => {
      prisma.emailLog.create.mockResolvedValue({ id: 'log-4' });

      await service.dispatch({
        recipient: 'buyer@example.com',
        type: EmailType.PAYMENT_RECEIPT,
        locale: 'en',
        currency: 'USD',
        variables: { amount: 1500 },
      });

      expect(prisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ amount: '$1,500.00' }),
          }),
        }),
      );
    });
  });

  describe('resend', () => {
    it('resets status to QUEUED and re-enqueues the job', async () => {
      prisma.emailLog.update.mockResolvedValue({
        id: 'log-1',
        status: EmailStatus.QUEUED,
      });

      const result = await service.resend('log-1');

      expect(prisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: { status: EmailStatus.QUEUED },
      });
      expect(queue.add).toHaveBeenCalledWith('send', { emailLogId: 'log-1' }, expect.any(Object));
      expect(result.status).toBe(EmailStatus.QUEUED);
    });
  });

  describe('findLogs', () => {
    it('applies filters and returns paginated results', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: 'log-1' }], 1]);

      const result = await service.findLogs({
        status: EmailStatus.SENT,
        page: 1,
        pageSize: 25,
      } as any);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        items: [{ id: 'log-1' }],
        total: 1,
        page: 1,
        pageSize: 25,
      });
    });
  });
});
