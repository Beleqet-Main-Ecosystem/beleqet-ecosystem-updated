import { EscrowService } from './escrow.service';
import { ESCROW_JOBS } from '../queues/queues.constants';

function buildService(overrides: Record<string, unknown> = {}) {
  const milestone = {
    id: 'milestone-1',
    amount: 1000,
    status: 'SUBMITTED',
    approvedAt: null,
    employerApprovedAt: null,
    freelancerApprovedAt: null,
    contract: {
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
      currency: 'ETB',
      freelanceJob: {
        escrowTx: { id: 'escrow-1', status: 'FUNDED' },
      },
    },
    ...overrides,
  };

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    milestone: {
      findFirst: jest.fn().mockResolvedValue(milestone),
      update: jest.fn(async ({ data }) => ({ ...milestone, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    freelancerWallet: { upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }) },
    walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'wallet-tx-1' }) },
    eventLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const escrowQueue = { add: jest.fn().mockResolvedValue({ id: 'auto-release:milestone-1' }) };
  const prisma = {
    milestone: {
      findFirst: jest.fn().mockResolvedValue(milestone),
      update: jest.fn(async ({ data }) => ({ ...milestone, ...data })),
    },
    eventLog: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  };

  const service = new EscrowService(
    prisma as never,
    { get: jest.fn() } as never,
    { convertCurrency: jest.fn((amount: number) => amount) } as never,
    { initializePayment: jest.fn() } as never,
    escrowQueue as never,
    { emit: jest.fn() } as never,
  );

  return { service, prisma, tx, escrowQueue };
}

function buildInitiateService() {
  const freelanceJob = {
    id: 'gig-1',
    title: 'Backend escrow task',
    budgetMax: 1000,
    currency: 'ETB',
    client: {
      email: 'client@example.com',
      firstName: 'Client',
      lastName: 'User',
    },
    contract: {
      agreedAmount: 1000,
    },
  };
  const employerWallet = {
    id: 'employer-wallet-1',
    userId: 'client-1',
    balance: 1000,
    lockedBalance: 0,
  };
  const escrow = {
    id: 'escrow-1',
    freelanceJobId: 'gig-1',
    grossAmount: 1000,
    platformFee: 100,
    netAmount: 900,
    walletAppliedAmount: 1000,
    currency: 'ETB',
    status: 'FUNDED',
    gatewayRef: 'tx-1',
  };

  const prisma = {
    freelanceJob: {
      findFirst: jest.fn().mockResolvedValue(freelanceJob),
      update: jest.fn().mockResolvedValue({ ...freelanceJob, status: 'FUNDED' }),
    },
    employerWallet: {
      findUnique: jest.fn().mockResolvedValue(employerWallet),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ ...employerWallet, lockedBalance: 0 }),
    },
    employerWalletTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'employer-wallet-tx-1' }),
    },
    escrowTransaction: {
      upsert: jest.fn().mockResolvedValue(escrow),
    },
    eventLog: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    $transaction: jest.fn(async (items: Promise<unknown>[]) => Promise.all(items)),
  };
  const escrowQueue = { add: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const chapaClient = { initializePayment: jest.fn() };

  const service = new EscrowService(
    prisma as never,
    { get: jest.fn() } as never,
    { convertCurrency: jest.fn((amount: number) => amount) } as never,
    chapaClient as never,
    escrowQueue as never,
    eventEmitter as never,
  );

  return { service, prisma, escrowQueue, eventEmitter, chapaClient };
}

describe('EscrowService milestone confirmations', () => {
  it('does not release after only one party confirms', async () => {
    const { service } = buildService();

    await expect(service.confirmMilestone('milestone-1', 'client-1')).resolves.toMatchObject({
      success: true,
      released: false,
      waitingFor: 'FREELANCER',
    });
  });

  it('serializes confirmation and only updates the confirming actor timestamp', async () => {
    const { service, tx } = buildService();

    await expect(service.confirmMilestone('milestone-1', 'client-1')).resolves.toMatchObject({
      success: true,
      released: false,
      waitingFor: 'FREELANCER',
    });

    expect(tx.$queryRaw).toHaveBeenCalled();
    const updateInput = tx.milestone.update.mock.calls[0][0];
    expect(updateInput.data.employerApprovedAt).toEqual(expect.any(Date));
    expect(updateInput.data).not.toHaveProperty('freelancerApprovedAt');
  });

  it('queues release after both parties confirm', async () => {
    const { service, prisma, tx, escrowQueue } = buildService({
      employerApprovedAt: new Date('2026-07-19T00:00:00Z'),
    });

    await expect(service.confirmMilestone('milestone-1', 'freelancer-1')).resolves.toMatchObject({
      success: true,
      released: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.milestone.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'milestone-1', status: { not: 'APPROVED' } },
      }),
    );
    expect(tx.freelancerWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'freelancer-1' },
        update: { pendingBalance: { increment: 900 } },
      }),
    );
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT_PENDING',
          amount: 900,
          milestoneId: 'milestone-1',
        }),
      }),
    );
    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.AUTO_RELEASE,
      expect.objectContaining({
        milestoneId: 'milestone-1',
        freelancerId: 'freelancer-1',
        amount: 900,
        releaseAt: expect.any(Date),
      }),
      expect.objectContaining({
        delay: expect.any(Number),
        jobId: 'auto-release:milestone-1',
      }),
    );
  });

  it('does not double-credit pending funds if another release already claimed approval', async () => {
    const { service, tx, escrowQueue } = buildService({
      employerApprovedAt: new Date('2026-07-19T00:00:00Z'),
    });
    tx.milestone.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.confirmMilestone('milestone-1', 'freelancer-1')).resolves.toMatchObject({
      success: true,
      released: true,
      alreadyReleased: true,
    });

    expect(tx.freelancerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.AUTO_RELEASE,
      expect.objectContaining({ milestoneId: 'milestone-1', amount: 900 }),
      expect.objectContaining({ jobId: 'auto-release:milestone-1' }),
    );
  });

  it('keeps the legacy release endpoint employer-only', async () => {
    const { service, tx } = buildService();

    await expect(service.releaseMilestone('milestone-1', 'freelancer-1')).rejects.toThrow(
      'Milestone not found',
    );

    expect(tx.milestone.update).not.toHaveBeenCalled();
  });

  it('re-enqueues the deterministic release job when an approved milestone is retried', async () => {
    const { service, prisma, escrowQueue } = buildService({
      status: 'APPROVED',
      approvedAt: new Date('2026-07-19T00:00:00Z'),
      employerApprovedAt: new Date('2026-07-19T00:00:00Z'),
      freelancerApprovedAt: new Date('2026-07-19T01:00:00Z'),
    });

    await expect(service.confirmMilestone('milestone-1', 'freelancer-1')).resolves.toMatchObject({
      success: true,
      released: true,
      alreadyReleased: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.AUTO_RELEASE,
      expect.objectContaining({
        milestoneId: 'milestone-1',
        freelancerId: 'freelancer-1',
        amount: 900,
      }),
      expect.objectContaining({
        jobId: 'auto-release:milestone-1',
      }),
    );
  });
});

describe('EscrowService initiate wallet funding', () => {
  it('starts the freelance job when escrow is fully funded from employer wallet', async () => {
    const { service, prisma, escrowQueue, eventEmitter, chapaClient } = buildInitiateService();

    await expect(service.initiate('client-1', 'gig-1')).resolves.toMatchObject({
      escrowId: 'escrow-1',
      checkoutUrl: null,
      grossAmount: 1000,
      platformFee: 100,
      netAmount: 900,
      walletAppliedAmount: 1000,
      amountToPay: 0,
    });

    expect(chapaClient.initializePayment).not.toHaveBeenCalled();
    expect(escrowQueue.add).not.toHaveBeenCalled();
    expect(prisma.freelanceJob.update).toHaveBeenCalledWith({
      where: { id: 'gig-1' },
      data: { status: 'FUNDED' },
    });
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'escrow.funded',
          entityId: 'escrow-1',
          payload: expect.objectContaining({ source: 'employer_wallet' }),
        }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.escrow.funded',
      expect.objectContaining({
        escrowId: 'escrow-1',
        source: 'employer_wallet',
      }),
    );
  });
});
