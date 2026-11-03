import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const tx = {
    job: { updateMany: jest.fn() },
    forumThread: { deleteMany: jest.fn(), update: jest.fn() },
    forumReply: { findUnique: jest.fn(), count: jest.fn(), delete: jest.fn() },
    contentReport: { updateMany: jest.fn() },
  };
  const prisma = {
    job: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    forumThread: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    forumReply: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    contentReport: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReportsService);
  });

  it('needs details when the reason is "other"', async () => {
    await expect(service.create('u1', { targetType: 'JOB', targetId: 'j1', reason: 'other' })).rejects.toThrow('Say what');
  });

  it('refuses a report about something that does not exist', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.create('u1', { targetType: 'JOB', targetId: 'j1', reason: 'scam' })).rejects.toThrow('no longer exists');
  });

  it('tells someone they already reported it', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'j1' });
    prisma.contentReport.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.create('u1', { targetType: 'JOB', targetId: 'j1', reason: 'scam' })).rejects.toThrow('already reported');
  });

  it('archives a reported job and closes every open report about it', async () => {
    prisma.contentReport.findUnique.mockResolvedValue({ id: 'r1', status: 'OPEN', targetType: 'JOB', targetId: 'j1' });
    await service.resolve('r1', 'admin', { action: 'remove' });
    expect(tx.job.updateMany).toHaveBeenCalledWith({ where: { id: 'j1' }, data: { status: 'ARCHIVED' } });
    expect(tx.contentReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { targetType: 'JOB', targetId: 'j1', status: 'OPEN' } }),
    );
  });

  it('removes a reply with its answers and keeps the thread count right', async () => {
    prisma.contentReport.findUnique.mockResolvedValue({ id: 'r1', status: 'OPEN', targetType: 'FORUM_REPLY', targetId: 'p1' });
    tx.forumReply.findUnique.mockResolvedValue({ threadId: 't1' });
    tx.forumReply.count.mockResolvedValue(2);
    await service.resolve('r1', 'admin', { action: 'remove' });
    expect(tx.forumThread.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { replyCount: { decrement: 3 } } });
  });

  it('only handles a report once', async () => {
    prisma.contentReport.findUnique.mockResolvedValue({ id: 'r1', status: 'DISMISSED' });
    await expect(service.resolve('r1', 'admin', { action: 'dismiss' })).rejects.toThrow('already been handled');
  });
});
