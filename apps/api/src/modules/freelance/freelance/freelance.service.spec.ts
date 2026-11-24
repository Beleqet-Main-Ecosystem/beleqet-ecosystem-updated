import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FreelanceService } from './freelance.service';

describe('FreelanceService', () => {
  const prisma = {
    freelanceJob: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    bid: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    contract: { findFirst: jest.fn() },
    dispute: { findUnique: jest.fn() },
    eventLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    milestone: {
      aggregate: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: FreelanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [FreelanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(FreelanceService);
    prisma.freelanceJob.findFirst.mockResolvedValue({ id: 'g1', clientId: 'client' });
    prisma.user.findUnique.mockResolvedValue({ role: 'FREELANCER' });
    prisma.bid.findUnique.mockResolvedValue(null);
  });

  const bid = { amount: 5000, proposal: 'I can do this', deliveryDays: 7 } as never;

  describe('submitBid', () => {
    it('refuses a bid on your own project', async () => {
      await expect(service.submitBid('client', 'g1', bid)).rejects.toThrow('your own project');
    });

    it('refuses bids from employer accounts', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'EMPLOYER' });
      await expect(service.submitBid('emp', 'g1', bid)).rejects.toThrow(
        'freelancer and job seeker',
      );
    });

    it('turns a simultaneous second bid into a clear conflict, not a server error', async () => {
      prisma.bid.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
      );
      await expect(service.submitBid('free', 'g1', bid)).rejects.toThrow('already submitted');
    });
  });

  describe('milestones', () => {
    const milestone = { title: 'Logo drafts', amount: 4000, deadline: '2026-12-01' } as never;

    it('starts a milestone as proposed, for the client to accept', async () => {
      prisma.contract.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        agreedAmount: 10000,
      });
      prisma.milestone.aggregate.mockResolvedValue({ _sum: { amount: 6000 } });
      prisma.milestone.create.mockResolvedValue({ id: 'm1', title: 'Logo drafts' });
      await service.createMilestone('free', 'c1', milestone);
      expect(prisma.milestone.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PROPOSED' }) }),
      );
    });

    it('keeps all milestones within the contract amount', async () => {
      prisma.contract.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        agreedAmount: 10000,
      });
      prisma.milestone.aggregate.mockResolvedValue({ _sum: { amount: 7000 } });
      await expect(service.createMilestone('free', 'c1', milestone)).rejects.toThrow(
        '3000 is left',
      );
    });

    it('lets only the contract client accept a proposed milestone', async () => {
      prisma.milestone.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.acceptMilestone('someone-else', 'm1')).rejects.toThrow(
        'No proposed milestone',
      );
      expect(prisma.milestone.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1', status: 'PROPOSED', contract: { clientId: 'someone-else' } },
        }),
      );
    });

    it('refuses work on a milestone the client has not accepted', async () => {
      prisma.milestone.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'PROPOSED',
        contract: { freelancerId: 'free' },
      });
      await expect(
        service.submitDeliverable('free', 'm1', { notes: 'done' } as never),
      ).rejects.toThrow('not accepted');
    });
  });

  describe('project list', () => {
    beforeEach(() => {
      prisma.freelanceJob.findMany.mockResolvedValue([
        { id: 'g1', title: 'Logo', client: { firstName: 'Abebe', lastName: 'Kebede' } },
      ]);
      prisma.freelanceJob.count.mockResolvedValue(1);
    });

    it('shows the client as first name and initial', async () => {
      const { items } = await service.findJobs({});
      expect(items[0]).toMatchObject({ id: 'g1', clientName: 'Abebe K.' });
      expect(items[0]).not.toHaveProperty('client');
    });

    it('searches skills and sorts by budget on the server', async () => {
      await service.findJobs({ q: 'logo design', sort: 'budget_high', budgetMin: 3000 });
      const args = prisma.freelanceJob.findMany.mock.calls[0][0];
      expect(JSON.stringify(args.where)).toContain('"hasSome":["logo design","Logo design"]');
      expect(args.where.AND).toContainEqual({ budgetMax: { gte: 3000 } });
      expect(args.orderBy[0]).toEqual({ budgetMax: 'desc' });
    });
  });

  it("lists only the caller's own projects, newest first, with bid counts and the contract", async () => {
    prisma.freelanceJob.findMany.mockResolvedValue([]);
    await service.getMyProjects('client');
    const args = prisma.freelanceJob.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ clientId: 'client' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.select._count).toEqual({ select: { bids: true } });
    expect(args.select.contract).toEqual({ select: { id: true, status: true } });
  });

  it("gives each bid the freelancer's track record", async () => {
    prisma.freelanceJob.findUnique.mockResolvedValue({ clientId: 'client' });
    const joined = new Date('2025-03-01');
    prisma.bid.findMany.mockResolvedValue([
      {
        id: 'b1',
        freelancer: {
          id: 'f1',
          firstName: 'Sara',
          lastName: 'T',
          createdAt: joined,
          portfolioUrl: 'https://sara.example',
          _count: { contractsAsFreelancer: 4 },
        },
      },
    ]);
    const [bid] = await service.findBids('g1', 'client');
    expect(bid.freelancer).toEqual({
      id: 'f1',
      firstName: 'Sara',
      lastName: 'T',
      portfolioUrl: 'https://sara.example',
      memberSince: joined,
      completedContracts: 4,
    });
  });

  it('lists contract activity with the milestone each event is about', async () => {
    const at = new Date('2026-11-01');
    prisma.contract.findFirst.mockResolvedValue({
      id: 'c1',
      milestones: [{ id: 'm1', title: 'Logo drafts' }],
      freelanceJob: { escrowTx: { id: 'e1' } },
    });
    prisma.dispute.findUnique.mockResolvedValue(null);
    prisma.eventLog.findMany
      .mockResolvedValueOnce([]) // revision notes
      .mockResolvedValueOnce([
        {
          eventType: 'milestone.revision_requested',
          entityId: 'm1',
          payload: { reason: 'Use the brand green' },
          createdAt: at,
        },
      ]);
    const contract = await service.getContract('c1', 'client');
    expect(contract.activity).toEqual([
      {
        type: 'milestone.revision_requested',
        at,
        milestone: 'Logo drafts',
        note: 'Use the brand green',
      },
    ]);
    expect(prisma.eventLog.findMany.mock.calls[1][0].where.entityId).toEqual({ in: ['m1', 'e1'] });
  });
});

describe('FreelanceService notices', () => {
  const contract = {
    clientId: 'client',
    freelancerId: 'free',
    currency: 'ETB',
    freelanceJob: { title: 'Logo design' },
    freelancer: { firstName: 'Sara', lastName: 'Tesfaye' },
  };
  const tx = {
    bid: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    contract: { create: jest.fn().mockResolvedValue({ id: 'c1' }) },
    freelanceJob: { update: jest.fn() },
    escrowTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
    chatRoom: { create: jest.fn() },
    milestone: { update: jest.fn().mockResolvedValue({ id: 'm1' }) },
    eventLog: { create: jest.fn() },
  };
  const prisma = {
    freelanceJob: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    bid: { findUnique: jest.fn(), create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    contract: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    milestone: { aggregate: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    eventLog: { create: jest.fn() },
    $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new FreelanceService(prisma as never, notifier as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.contract.findUniqueOrThrow.mockResolvedValue(contract);
  });

  it('tells the client about a new bid, with who bid and how much', async () => {
    prisma.freelanceJob.findFirst.mockResolvedValue({
      id: 'g1',
      clientId: 'client',
      title: 'Logo design',
      currency: 'ETB',
    });
    prisma.user.findUnique.mockResolvedValue({
      role: 'FREELANCER',
      firstName: 'Sara',
      lastName: 'Tesfaye',
    });
    prisma.bid.findUnique.mockResolvedValue(null);
    prisma.bid.create.mockResolvedValue({ id: 'b1', amount: 5000 });
    await service.submitBid('free', 'g1', {
      amount: 5000,
      proposal: 'I can',
      deliveryDays: 7,
    } as never);
    expect(notifier.notify).toHaveBeenCalledWith(
      'client',
      expect.objectContaining({
        body: 'Sara Tesfaye bid ETB 5,000 on "Logo design".',
        metadata: { freelanceJobId: 'g1' },
      }),
    );
  });

  it('tells the chosen freelancer and everyone whose bid it turned down', async () => {
    prisma.bid.findFirst.mockResolvedValue({
      id: 'b1',
      status: 'PENDING',
      amount: 5000,
      freelancerId: 'free',
      freelanceJobId: 'g1',
      freelanceJob: { id: 'g1', title: 'Logo design', status: 'OPEN' },
    });
    prisma.bid.findMany.mockResolvedValue([{ freelancerId: 'other1' }, { freelancerId: 'other2' }]);
    await service.acceptBid('b1', 'client');
    expect(notifier.notify.mock.calls.map(([to, notice]) => [to, notice.type])).toEqual([
      ['free', 'FREELANCE_BID_ACCEPTED'],
      ['other1', 'FREELANCE_BID_REJECTED'],
      ['other2', 'FREELANCE_BID_REJECTED'],
    ]);
    expect(notifier.notify.mock.calls[0][1].metadata).toEqual({ contractId: 'c1' });
  });

  it('tells the freelancer what the client wants changed', async () => {
    prisma.milestone.findUnique.mockResolvedValue({
      id: 'm1',
      title: 'Drafts',
      status: 'SUBMITTED',
      contractId: 'c1',
      contract: { clientId: 'client', freelancerId: 'free' },
    });
    await service.requestRevision('client', 'm1', 'Make the logo bigger');
    const [to, notice] = notifier.notify.mock.calls[0];
    expect(to).toBe('free');
    expect(notice.telegram.en).toContain('Make the logo bigger');
    expect(notice.button.web).toBe('/freelance/contracts/c1');
  });

  it('still adds the milestone when its notice fails', async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      agreedAmount: 10000,
    });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.milestone.create.mockResolvedValue({ id: 'm1', title: 'Drafts', amount: 4000 });
    prisma.contract.findUniqueOrThrow.mockRejectedValue(new Error('database busy'));
    await expect(
      service.createMilestone('free', 'c1', {
        title: 'Drafts',
        amount: 4000,
        deadline: '2026-12-01',
      } as never),
    ).resolves.toMatchObject({ id: 'm1' });
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
