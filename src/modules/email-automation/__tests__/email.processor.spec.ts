import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailStatus } from '@prisma/client';
import { EmailProcessor } from '../email.processor';
import { PrismaService } from '../../../prisma/prisma.service';

describe('EmailProcessor (queue integration)', () => {
  let processor: EmailProcessor;
  let prisma: { emailLog: any };
  let mailer: { sendMail: jest.Mock };

  const baseLog = {
    id: 'log-1',
    recipient: 'user@example.com',
    subject: 'Welcome to Beleqet',
    locale: 'en',
    templateName: 'welcome',
    metadata: { name: 'Tekalign' },
  };

  beforeEach(async () => {
    prisma = {
      emailLog: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseLog),
        update: jest.fn(),
      },
    };
    mailer = { sendMail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: MailerService, useValue: mailer },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(EmailProcessor);
  });

  it('sends the email and marks the log SENT on success', async () => {
    mailer.sendMail.mockResolvedValue({ messageId: 'msg-123' });
    const job = { data: { emailLogId: 'log-1' } } as Job<{ emailLogId: string }>;

    await processor.process(job);

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: baseLog.recipient,
        subject: baseLog.subject,
        template: './en/welcome',
        context: { name: 'Tekalign' },
      }),
    );
    expect(prisma.emailLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: EmailStatus.SENT,
        providerMsgId: 'msg-123',
      }),
    });
  });

  it('marks the log FAILED and rethrows so BullMQ retries', async () => {
    mailer.sendMail.mockRejectedValue(new Error('SMTP timeout'));
    const job = { data: { emailLogId: 'log-1' } } as Job<{ emailLogId: string }>;

    await expect(processor.process(job)).rejects.toThrow('SMTP timeout');

    expect(prisma.emailLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: EmailStatus.FAILED,
        errorMessage: 'SMTP timeout',
      }),
    });
  });
});
