import { EscrowService } from './escrow.service';

function buildService(overrides: Record<string, unknown> = {}) {
  const milestone = {
    id: 'milestone-1',
    amount: 1000,
    status: 'SUBMITTED',
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

  const prisma = {
    milestone: {
      findFirst: jest.fn().mockResolvedValue(milestone),
      update: jest.fn(async ({ data }) => ({ ...milestone, ...data })),
    },
    eventLog: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    freelancerWallet: {
      upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        milestone: { update: jest.fn().mockResolvedValue({}) },
        eventLog: { create: jest.fn().mockResolvedValue({}) },
      }),
    ),
  };

  const service = new EscrowService(
    prisma as never,
    { get: jest.fn() } as never,
    { convertCurrency: jest.fn((amount: number) => amount) } as never,
    { initializePayment: jest.fn() } as never,
    { add: jest.fn() } as never,
    { emit: jest.fn() } as never,
  );

  return { service, prisma };
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
    const { service } = buildService({ employerApprovedAt: new Date('2026-07-19T00:00:00Z') });

    await expect(service.confirmMilestone('milestone-1', 'freelancer-1')).resolves.toMatchObject({
      success: true,
      released: true,
    });
  });
});
