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
    milestone: { update: jest.fn().mockResolvedValue({}) },
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

describe('EscrowService milestone confirmations', () => {
  it('does not release after only one party confirms', async () => {
    const { service } = buildService();

    await expect(service.confirmMilestone('milestone-1', 'client-1')).resolves.toMatchObject({
      success: true,
      released: false,
      waitingFor: 'FREELANCER',
    });
  });

  it('queues release after both parties confirm', async () => {
    const { service, prisma, tx, escrowQueue } = buildService({
      employerApprovedAt: new Date('2026-07-19T00:00:00Z'),
    });

    await expect(service.confirmMilestone('milestone-1', 'freelancer-1')).resolves.toMatchObject({
      success: true,
      released: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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

    expect(prisma.$transaction).not.toHaveBeenCalled();
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
