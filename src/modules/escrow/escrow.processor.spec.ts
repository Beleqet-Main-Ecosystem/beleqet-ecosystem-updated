import { Job } from 'bullmq';
import { ESCROW_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { EscrowProcessor } from './escrow.processor';

function buildProcessor() {
  const escrow = {
    id: 'escrow-1',
    freelanceJobId: 'gig-1',
    grossAmount: 1000,
    walletAppliedAmount: 100,
    currency: 'ETB',
    status: 'PENDING',
    gatewayRef: 'tx-1',
    freelanceJob: { clientId: 'client-1' },
  };

  const eventLogFindFirst = jest.fn().mockResolvedValue(null);
  const eventLogCreate = jest.fn((input) => Promise.resolve(input));
  const employerWalletFindUnique = jest.fn().mockResolvedValue({ id: 'wallet-1' });
  const employerWalletUpdate = jest.fn((input) => Promise.resolve(input));
  const employerWalletTransactionCreate = jest.fn((input) => Promise.resolve(input));

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    eventLog: {
      findFirst: eventLogFindFirst,
      create: eventLogCreate,
    },
    escrowTransaction: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    freelanceJob: {
      update: jest.fn((input) => Promise.resolve(input)),
    },
    employerWallet: {
      findUnique: employerWalletFindUnique,
      update: employerWalletUpdate,
    },
    employerWalletTransaction: {
      create: employerWalletTransactionCreate,
    },
    freelancerWallet: {
      upsert: jest.fn().mockResolvedValue({ id: 'freelancer-wallet-1' }),
    },
    walletTransaction: {
      create: jest.fn((input) => Promise.resolve(input)),
    },
  };

  const prisma = {
    eventLog: {
      findFirst: eventLogFindFirst,
      create: eventLogCreate,
    },
    escrowTransaction: {
      findFirst: jest.fn().mockResolvedValue(escrow),
      update: jest.fn((input) => Promise.resolve(input)),
      findUnique: jest.fn(),
    },
    freelanceJob: {
      update: jest.fn((input) => Promise.resolve(input)),
    },
    employerWallet: {
      findUnique: employerWalletFindUnique,
      update: employerWalletUpdate,
    },
    employerWalletTransaction: {
      create: employerWalletTransactionCreate,
    },
    freelancerWallet: {
      upsert: jest.fn().mockResolvedValue({ id: 'freelancer-wallet-1' }),
    },
    walletTransaction: {
      create: jest.fn((input) => Promise.resolve(input)),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'freelancer-1', telegramId: null }),
    },
    $transaction: jest.fn(async (operation: Promise<unknown>[] | ((tx: unknown) => unknown)) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }
      return operation(tx);
    }),
  };

  const chapa = {
    paymentResult: jest.fn().mockResolvedValue({
      state: 'success',
      amount: 900,
      currency: 'ETB',
      raw: { status: 'success' },
    }),
  };

  const planPayments = { handlePaymentEvent: jest.fn().mockResolvedValue(false) };
  const notificationsQueue = { add: jest.fn() };
  const escrowQueue = { add: jest.fn() };
  const processor = new EscrowProcessor(
    prisma as never,
    { get: jest.fn(() => 'http://localhost:3000') } as never,
    chapa as never,
    planPayments as never,
    notificationsQueue as never,
    escrowQueue as never,
  );

  return { processor, prisma, tx, chapa, planPayments, notificationsQueue, escrowQueue };
}

describe('EscrowProcessor', () => {
  it('verifies Chapa before marking escrow funded', async () => {
    const { processor, tx, chapa, notificationsQueue } = buildProcessor();

    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: 'tx-1', reference: 'chapa-ref', status: 'success' },
    } as Job);

    expect(chapa.paymentResult).toHaveBeenCalledWith('tx-1');
    expect(tx.escrowTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FUNDED' }) }),
    );
    expect(tx.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'chapa.webhook.processed' }),
      }),
    );
    expect(notificationsQueue.add).toHaveBeenCalled();
  });

  it('skips duplicate webhook events', async () => {
    const { processor, prisma, chapa } = buildProcessor();
    prisma.eventLog.findFirst.mockResolvedValueOnce({ id: 'event-1' });

    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: 'tx-1', reference: 'chapa-ref', status: 'success' },
    } as Job);

    expect(chapa.paymentResult).not.toHaveBeenCalled();
  });

  it('does not fund when Chapa reports a different amount', async () => {
    const { processor, tx, chapa } = buildProcessor();
    chapa.paymentResult.mockResolvedValue({
      state: 'success',
      amount: 1,
      currency: 'ETB',
      raw: {},
    });
    await expect(
      processor.handleWebhook({
        data: { event: 'charge.success', tx_ref: 'tx-1', status: 'success' },
      } as Job),
    ).rejects.toThrow('Chapa verification mismatch');
    expect(tx.escrowTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('does not fund when Chapa says the payment is not paid, whatever the event claims', async () => {
    const { processor, tx, chapa } = buildProcessor();
    chapa.paymentResult.mockResolvedValue({
      state: 'pending',
      amount: 900,
      currency: 'ETB',
      raw: {},
    });
    await expect(
      processor.handleWebhook({
        data: { event: 'charge.success', tx_ref: 'tx-1', status: 'success' },
      } as Job),
    ).rejects.toThrow('Chapa verification mismatch');
    expect(tx.escrowTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('finds the escrow from an older checkout reference that was paid after all', async () => {
    const { processor, prisma, chapa } = buildProcessor();
    const escrowId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const oldRef = `E-${escrowId}-lz1abc`;
    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: oldRef, status: 'success' },
    } as Job);
    expect(prisma.escrowTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: expect.arrayContaining([{ id: escrowId }]) },
      }),
    );
    expect(chapa.paymentResult).toHaveBeenCalledWith(oldRef);
  });

  it('passes a payment that is not an escrow on to plan payments', async () => {
    const { processor, prisma, planPayments, chapa } = buildProcessor();
    prisma.escrowTransaction.findFirst.mockResolvedValue(null);
    planPayments.handlePaymentEvent.mockResolvedValue(true);
    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: 'CHAPA-1', status: 'success' },
    } as Job);
    expect(planPayments.handlePaymentEvent).toHaveBeenCalledWith({
      txRef: 'CHAPA-1',
      externalRef: undefined,
      successful: true,
    });
    expect(chapa.paymentResult).not.toHaveBeenCalled();
  });

  it('moves auto-release funds inside one idempotent transaction', async () => {
    const { processor, prisma, tx, notificationsQueue } = buildProcessor();

    await processor.handleAutoRelease({
      data: {
        milestoneId: 'milestone-1',
        freelancerId: 'freelancer-1',
        amount: 900,
        releaseAt: new Date(Date.now() - 1000).toISOString(),
      },
    } as Job);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.eventLog.findFirst).toHaveBeenCalledWith({
      where: { eventType: 'wallet.credited', entityId: 'milestone-1' },
    });
    expect(tx.freelancerWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'freelancer-1' },
        update: {
          pendingBalance: { decrement: 900 },
          availableBalance: { increment: 900 },
        },
      }),
    );
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT_AVAILABLE',
          amount: 900,
          milestoneId: 'milestone-1',
        }),
      }),
    );
    expect(tx.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'wallet.credited',
          entityId: 'milestone-1',
        }),
      }),
    );
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      NOTIFICATION_JOBS.SEND_IN_APP,
      expect.objectContaining({
        userId: 'freelancer-1',
        type: 'wallet.credited',
      }),
    );
  });

  it('skips duplicate auto-release retries after the wallet credit event exists', async () => {
    const { processor, tx, notificationsQueue } = buildProcessor();
    tx.eventLog.findFirst.mockResolvedValueOnce({ id: 'wallet-credit-1' });

    await processor.handleAutoRelease({
      data: {
        milestoneId: 'milestone-1',
        freelancerId: 'freelancer-1',
        amount: 900,
        releaseAt: new Date(Date.now() - 1000).toISOString(),
      },
    } as Job);

    expect(tx.freelancerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(notificationsQueue.add).not.toHaveBeenCalled();
  });

  it('requeues early auto-release jobs with a deterministic job id', async () => {
    const { processor, prisma, escrowQueue } = buildProcessor();
    const futureReleaseAt = new Date(Date.now() + 60_000).toISOString();

    await processor.handleAutoRelease({
      data: {
        milestoneId: 'milestone-1',
        freelancerId: 'freelancer-1',
        amount: 900,
        releaseAt: futureReleaseAt,
      },
    } as Job);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.AUTO_RELEASE,
      expect.objectContaining({ milestoneId: 'milestone-1', releaseAt: futureReleaseAt }),
      expect.objectContaining({
        delay: expect.any(Number),
        jobId: 'auto-release:milestone-1',
      }),
    );
  });

  it('claims stale escrows inside the refund transaction before crediting the employer', async () => {
    const { processor, tx } = buildProcessor();

    await processor.handleUnlockFunds({
      data: { escrowId: 'escrow-1', clientId: 'client-1', amount: 100 },
    } as Job);

    expect(tx.escrowTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'escrow-1', status: { notIn: ['FUNDED', 'REFUNDED'] } },
      data: { status: 'REFUNDED' },
    });
    expect(tx.employerWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wallet-1' },
        data: {
          lockedBalance: { decrement: 100 },
          balance: { increment: 100 },
        },
      }),
    );
    expect(tx.employerWalletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT_AVAILABLE',
          amount: 100,
          escrowId: 'escrow-1',
        }),
      }),
    );
  });

  it('does not double-refund if another worker already claimed the escrow', async () => {
    const { processor, tx } = buildProcessor();
    tx.escrowTransaction.updateMany.mockResolvedValueOnce({ count: 0 });

    await processor.handleUnlockFunds({
      data: { escrowId: 'escrow-1', clientId: 'client-1', amount: 100 },
    } as Job);

    expect(tx.employerWallet.update).not.toHaveBeenCalled();
    expect(tx.employerWalletTransaction.create).not.toHaveBeenCalled();
  });
});
