import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobsService, nextStatus } from './jobs.service';
import { JobType } from './dto/create-job.dto';

// Rendering needs dynamic imports Jest doesn't run; the subjects are what these tests check.
jest.mock('../notifications/email-templates', () => {
  const rendered = () => jest.fn().mockResolvedValue({ html: '<p>email</p>', text: 'email' });
  return {
    jobPostConfirmationEmail: rendered(),
    jobAlertEmail: rendered(),
    jobRejectedEmail: rendered(),
    jobSubmittedEmail: rendered(),
  };
});

const company = { id: 'c1', name: 'Acme', userId: 'emp1' };
const employer = { id: 'emp1', firstName: 'Abebe', email: 'hr@acme.et', role: 'EMPLOYER' };

function setup() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(employer) },
    company: { findUnique: jest.fn().mockResolvedValue(company) },
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    plan: {
      findFirst: jest.fn().mockResolvedValue({ name: 'Free', features: { maxJobPosts: -1 } }),
    },
    job: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    jobAlert: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    notification: { create: jest.fn() },
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const telegram = {
    broadcastJob: jest.fn().mockResolvedValue(true),
    notifyReviewers: jest.fn().mockResolvedValue(true),
  };
  const push = { sendToUser: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('https://beleqetjobs.com') };
  const service = new JobsService(
    prisma as never,
    config as never,
    queue as never,
    telegram as never,
    push as never,
  );
  return { service, prisma, queue, telegram, push };
}

const input = {
  title: 'Accountant',
  description: 'Keep the books of a growing trading company in Addis Ababa.',
  location: 'Addis Ababa',
  type: JobType.FULL_TIME,
  categoryId: 'cat1',
};

/** Lets the fire-and-forget alert promises settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Emails are rendered before they are queued: wait until the first one is. */
async function queued(queue: { add: jest.Mock }) {
  for (let i = 0; i < 200 && queue.add.mock.calls.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return queue.add.mock.calls[0][1] as { subject: string };
}

describe('JobsService: admin approval of new jobs', () => {
  it("sends an employer's new job for review: not public, not broadcast", async () => {
    const { service, prisma, telegram, queue } = setup();
    prisma.job.create.mockImplementation(({ data }) => ({ id: 'j1', ...data, company }));

    const job = await service.create('emp1', input);
    await settle();

    expect(job.status).toBe('PENDING_REVIEW');
    expect(prisma.job.create.mock.calls[0][0].data).not.toHaveProperty('approvedAt');
    expect(telegram.broadcastJob).not.toHaveBeenCalled();
    expect(prisma.jobAlert.findMany).not.toHaveBeenCalled();
    expect(telegram.notifyReviewers).toHaveBeenCalledWith({
      title: 'Accountant',
      companyName: 'Acme',
    });
    expect((await queued(queue)).subject).toBe('We received "Accountant"');
  });

  it('ignores an employer asking to publish directly', async () => {
    const { service, prisma } = setup();
    prisma.job.create.mockImplementation(({ data }) => ({ id: 'j1', ...data, company }));
    const job = await service.create('emp1', { ...input, status: 'PUBLISHED' as never });
    expect(job.status).toBe('PENDING_REVIEW');
  });

  it('keeps a draft a draft, with no review alert', async () => {
    const { service, prisma, telegram } = setup();
    prisma.job.create.mockImplementation(({ data }) => ({ id: 'j1', ...data, company }));
    const job = await service.create('emp1', { ...input, status: 'DRAFT' as never });
    await settle();
    expect(job.status).toBe('DRAFT');
    expect(telegram.notifyReviewers).not.toHaveBeenCalled();
  });

  it("publishes an admin's own job at once and announces it", async () => {
    const { service, prisma, telegram, queue } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...employer, role: 'ADMIN' });
    prisma.job.create.mockImplementation(({ data }) => ({ id: 'j2', ...data, company }));

    const job = await service.create('emp1', input);
    await settle();

    expect(job.status).toBe('PUBLISHED');
    expect(prisma.job.create.mock.calls[0][0].data.approvedAt).toBeInstanceOf(Date);
    expect(telegram.broadcastJob).toHaveBeenCalled();
    expect((await queued(queue)).subject).toContain('is live');
  });

  it('approving publishes the job, tells the employer and announces it', async () => {
    const { service, prisma, telegram, push } = setup();
    prisma.job.findUniqueOrThrow.mockResolvedValue({
      id: 'j1',
      title: 'Accountant',
      company: { ...company, user: employer },
    });

    await service.approve('j1');
    await settle();

    expect(prisma.job.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'j1', status: 'PENDING_REVIEW' },
      data: { status: 'PUBLISHED', reviewedAt: expect.any(Date), reviewNote: null },
    });
    expect(prisma.job.updateMany.mock.calls[1][0].where).toEqual({ id: 'j1', approvedAt: null });
    expect(telegram.broadcastJob).toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'emp1',
      type: 'JOB_APPROVED',
    });
    expect(push.sendToUser).toHaveBeenCalledWith(
      'emp1',
      expect.objectContaining({ title: 'Your job is live' }),
    );
  });

  it('approves only a job that is waiting for review', async () => {
    const { service, prisma, telegram } = setup();
    prisma.job.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.approve('j1')).rejects.toThrow(ConflictException);
    expect(telegram.broadcastJob).not.toHaveBeenCalled();
  });

  it('rejecting keeps the reason and tells the employer, without announcing anything', async () => {
    const { service, prisma, telegram, queue } = setup();
    prisma.job.findUniqueOrThrow.mockResolvedValue({
      id: 'j1',
      title: 'Accountant',
      company: { ...company, user: employer },
    });

    await service.reject('j1', '  Add the salary range  ');
    await settle();

    expect(prisma.job.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Add the salary range',
    });
    expect(prisma.notification.create.mock.calls[0][0].data.body).toContain('Add the salary range');
    expect((await queued(queue)).subject).toContain('needs changes');
    expect(telegram.broadcastJob).not.toHaveBeenCalled();
  });

  it('needs a reason to reject', async () => {
    const { service, prisma } = setup();
    await expect(service.reject('j1', '   ')).rejects.toThrow('Say why');
    expect(prisma.job.updateMany).not.toHaveBeenCalled();
  });
});

describe('nextStatus: what an employer can do with a job', () => {
  const never = { status: 'DRAFT' as const, approvedAt: null };
  const approved = { status: 'CLOSED' as const, approvedAt: new Date() };

  it('sends a job never approved for review instead of publishing it', () => {
    expect(nextStatus(never, 'PUBLISHED', false)).toBe('PENDING_REVIEW');
    expect(nextStatus({ status: 'REJECTED', approvedAt: null }, 'PUBLISHED', false)).toBe(
      'PENDING_REVIEW',
    );
  });

  it('reopens an approved job without a new review', () => {
    expect(nextStatus(approved, 'PUBLISHED', false)).toBe('PUBLISHED');
  });

  it('lets the employer close a job or keep it as a draft', () => {
    expect(nextStatus(approved, 'CLOSED', false)).toBe('CLOSED');
    expect(nextStatus(never, 'DRAFT', false)).toBe('DRAFT');
  });

  it('keeps the review statuses for admins', () => {
    expect(() => nextStatus(never, 'PENDING_REVIEW', false)).toThrow(ForbiddenException);
    expect(nextStatus(never, 'PUBLISHED', true)).toBe('PUBLISHED');
  });
});

describe('JobsService.update: publishing sends a job for review', () => {
  it('a draft sent by the employer goes to review and alerts the reviewers once', async () => {
    const { service, prisma, telegram } = setup();
    prisma.job.findFirst.mockResolvedValue({
      id: 'j1',
      status: 'DRAFT',
      approvedAt: null,
      featured: false,
    });
    prisma.job.update.mockImplementation(({ data }) => ({
      id: 'j1',
      title: 'Accountant',
      company,
      ...data,
    }));

    const job = await service.update('j1', 'emp1', { status: 'PUBLISHED' as never });
    await settle();

    expect(job.status).toBe('PENDING_REVIEW');
    expect(prisma.job.update.mock.calls[0][0].data).toMatchObject({ reviewNote: null });
    expect(telegram.notifyReviewers).toHaveBeenCalledTimes(1);
    expect(telegram.broadcastJob).not.toHaveBeenCalled();
  });
});

describe('JobsService.findOne: who sees a job that is not public', () => {
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'REJECTED']) {
    it(`hides a ${status} job from the public, not from its employer or admins`, async () => {
      const { service, prisma } = setup();
      prisma.job.findUnique.mockResolvedValue({ id: 'j1', status, company });

      await expect(service.findOne('j1')).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('j1', { userId: 'someone', role: 'JOB_SEEKER' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('j1', { userId: 'emp1', role: 'EMPLOYER' }),
      ).resolves.toMatchObject({
        id: 'j1',
      });
      await expect(
        service.findOne('j1', { userId: 'admin', role: 'ADMIN' }),
      ).resolves.toMatchObject({
        id: 'j1',
      });
    });
  }

  it('shows a published job to everyone', async () => {
    const { service, prisma } = setup();
    prisma.job.findUnique.mockResolvedValue({ id: 'j1', status: 'PUBLISHED', company });
    await expect(service.findOne('j1')).resolves.toMatchObject({ id: 'j1' });
  });
});

describe('JobsService: plan limit counts jobs sent for review, not drafts or rejected ones', () => {
  function onFreePlan(used: number) {
    const ctx = setup();
    ctx.prisma.plan.findFirst.mockResolvedValue({ name: 'Free', features: { maxJobPosts: 1 } });
    ctx.prisma.job.count.mockResolvedValue(used);
    ctx.prisma.job.create.mockImplementation(({ data }) => ({ id: 'j9', ...data, company }));
    return ctx;
  }

  it('counts only jobs that were approved or are waiting for review', async () => {
    const { service, prisma } = onFreePlan(0);
    await service.getQuota('emp1');
    expect(prisma.job.count.mock.calls[0][0].where).toMatchObject({
      company: { userId: 'emp1' },
      OR: [{ approvedAt: { not: null } }, { status: 'PENDING_REVIEW' }],
    });
  });

  it('refuses a second job for review on the Free plan, but still saves a draft', async () => {
    const { service } = onFreePlan(1);
    await expect(service.create('emp1', input)).rejects.toThrow('your 1 job post');
    await expect(
      service.create('emp1', { ...input, status: 'DRAFT' } as never),
    ).resolves.toMatchObject({
      status: 'DRAFT',
    });
  });

  it('checks the limit when a draft or a rejected job is sent for review', async () => {
    for (const status of ['DRAFT', 'REJECTED']) {
      const { service, prisma } = onFreePlan(1);
      prisma.job.findFirst.mockResolvedValue({
        id: 'j1',
        status,
        approvedAt: null,
        featured: false,
      });
      await expect(service.update('j1', 'emp1', { status: 'PUBLISHED' } as never)).rejects.toThrow(
        'your 1 job post',
      );
      expect(prisma.job.update).not.toHaveBeenCalled();
    }
  });

  it('reopens a job approved before without using another post', async () => {
    const { service, prisma } = onFreePlan(1);
    prisma.job.findFirst.mockResolvedValue({
      id: 'j1',
      status: 'CLOSED',
      approvedAt: new Date(),
      featured: false,
    });
    prisma.job.update.mockResolvedValue({ id: 'j1', status: 'PUBLISHED', company });
    await service.update('j1', 'emp1', { status: 'PUBLISHED' } as never);
    expect(prisma.job.update.mock.calls[0][0].data.status).toBe('PUBLISHED');
  });
});

describe('JobsService: job alerts by email and Telegram', () => {
  const seeker = (id: string, fields: Record<string, unknown> = {}) => ({
    id: `alert-${id}`,
    userId: id,
    keywords: ['Accountant'],
    location: null,
    jobType: null,
    minSalary: null,
    user: {
      id,
      email: `${id}@mail.com`,
      firstName: id,
      telegramId: null,
      gender: null,
      notificationPreference: null,
      ...fields,
    },
  });

  async function approveWith(alerts: unknown[], jobGender: string | null = null) {
    const ctx = setup();
    ctx.prisma.jobAlert.findMany.mockResolvedValue(alerts);
    ctx.prisma.job.findUniqueOrThrow.mockResolvedValue({
      id: 'j1',
      title: 'Accountant',
      description: '',
      tags: [],
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      salaryMin: null,
      salaryMax: null,
      gender: jobGender,
      company: { ...company, user: employer },
    });
    await ctx.service.approve('j1');
    for (let i = 0; i < 50; i++) await settle();
    return ctx;
  }

  const telegramSends = (queue: { add: jest.Mock }) =>
    queue.add.mock.calls.filter(([name]) => name === 'send-telegram').map(([, data]) => data);

  it('sends a Telegram message to people with Telegram, as well as the email', async () => {
    const { queue } = await approveWith([seeker('a', { telegramId: '555' })]);
    expect(telegramSends(queue)).toEqual([
      {
        telegramId: '555',
        message: expect.stringContaining('New job for you: Accountant at Acme'),
      },
    ]);
  });

  it('respects the channels each person turned off', async () => {
    const { queue } = await approveWith([
      seeker('a', {
        telegramId: '555',
        notificationPreference: { emailEnabled: true, telegramEnabled: false },
      }),
    ]);
    expect(telegramSends(queue)).toEqual([]);
  });

  it('skips people of the other gender for a job that asks for one', async () => {
    const { prisma, queue } = await approveWith(
      [
        seeker('man', { telegramId: '1', gender: 'MALE' }),
        seeker('woman', { telegramId: '2', gender: 'FEMALE' }),
        seeker('unsaid', { telegramId: '3' }),
      ],
      'FEMALE',
    );
    expect(
      telegramSends(queue)
        .map((data) => data.telegramId)
        .sort(),
    ).toEqual(['2', '3']);
    expect(prisma.jobAlert.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['alert-woman', 'alert-unsaid'] } },
      data: { lastSentAt: expect.any(Date) },
    });
  });
});
