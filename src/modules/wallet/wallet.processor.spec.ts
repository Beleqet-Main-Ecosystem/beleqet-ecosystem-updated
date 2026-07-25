import { Job } from 'bullmq';
import { WalletProcessor } from './wallet.processor';
import { WALLET_JOBS } from '../queues/queues.constants';

function buildProcessor(
  note = 'WITHDRAWAL_PENDING - Withdrawal of 10 USD via CHAPA - pending Chapa payout of ETB 1205',
) {
  const withdrawal = {
    id: 'tx-001',
    walletId: 'wallet-user-001',
    amount: 1205,
    type: 'DEBIT_WITHDRAWAL',
    note,
  };

  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    freelancerWallet: {
      update: jest.fn().mockResolvedValue({ id: 'wallet-user-001' }),
    },
    eventLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    walletTransaction: {
      findUnique: jest.fn().mockResolvedValue(withdrawal),
      create: jest.fn().mockResolvedValue({ id: 'credit-tx-1' }),
      update: jest.fn().mockResolvedValue(withdrawal),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (input: unknown) =>
    typeof input === 'function' ? input(prisma) : Promise.all(input as Promise<unknown>[]),
  );
  const config = {
    get: jest.fn((key: string) => (key === 'CHAPA_SECRET_KEY' ? 'test-secret' : undefined)),
  };
  const chapaClient = {
    createTransfer: jest.fn().mockResolvedValue({
      status: 'success',
      data: { reference: 'provider-ref-001' },
    }),
    verifyTransfer: jest.fn().mockRejectedValue(new Error('transfer not found')),
  };

  const processor = new WalletProcessor(prisma as never, config as never, chapaClient as never);
  return { processor, prisma, config, chapaClient };
}

const withdrawalJob = {
  name: WALLET_JOBS.PROCESS_WITHDRAWAL,
  data: {
    withdrawalTxId: 'tx-001',
    userId: 'user-001',
    walletId: 'wallet-user-001',
    requestedAmount: 10,
    requestedCurrency: 'USD',
    walletAmount: 1205,
    payoutAmount: 1205,
    payoutCurrency: 'ETB',
    method: 'CHAPA',
    accountRef: '0912345678',
  },
} as Job;

describe('WalletProcessor withdrawals', () => {
  it('submits the ETB-converted payout amount to Chapa using the ledger id reference', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();

    await processor.process(withdrawalJob);

    expect(chapaClient.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '0912345678',
        amount: '1205',
        currency: 'ETB',
        reference: 'tx-001',
      }),
    );
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-001' },
        data: expect.objectContaining({
          note: expect.stringContaining('Chapa transfer submitted'),
        }),
      }),
    );
  });

  it('restores the reserved balance when Chapa rejects the payout', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    chapaClient.createTransfer.mockResolvedValueOnce({
      status: 'error',
      message: 'Invalid account number',
    });

    await processor.process(withdrawalJob);

    expect(prisma.freelancerWallet.update).toHaveBeenCalledWith({
      where: { userId: 'user-001' },
      data: { availableBalance: { increment: 1205 } },
    });
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-001' },
        data: { note: 'WITHDRAWAL_FAILED - Withdrawal FAILED: Invalid account number' },
      }),
    );
  });

  it('skips duplicate jobs after the withdrawal is finalized', async () => {
    const { processor, chapaClient } = buildProcessor(
      'WITHDRAWAL_SUBMITTED - Withdrawal via CHAPA - Chapa transfer submitted (provider-ref-001)',
    );

    await processor.process(withdrawalJob);

    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
  });

  it('does not restore twice when a rejected withdrawal was already finalized', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    chapaClient.createTransfer.mockResolvedValueOnce({
      status: 'error',
      message: 'Invalid account number',
    });
    prisma.walletTransaction.findUnique
      .mockResolvedValueOnce({
        id: 'tx-001',
        walletId: 'wallet-user-001',
        amount: 1205,
        type: 'DEBIT_WITHDRAWAL',
        note: 'WITHDRAWAL_PENDING - Withdrawal of 10 USD via CHAPA - pending Chapa payout of ETB 1205',
      })
      .mockResolvedValueOnce({
        id: 'tx-001',
        walletId: 'wallet-user-001',
        amount: 1205,
        type: 'DEBIT_WITHDRAWAL',
        note: 'WITHDRAWAL_SUBMITTED - Withdrawal via CHAPA - Chapa transfer submitted (provider-ref-001)',
      });

    await processor.process(withdrawalJob);

    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
  });

  it('lets transient Chapa errors retry without restoring reserved funds', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    chapaClient.createTransfer.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(processor.process(withdrawalJob)).rejects.toThrow('ECONNRESET');

    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-001' },
        data: expect.objectContaining({
          note: expect.stringContaining('WITHDRAWAL_PROCESSING'),
        }),
      }),
    );
    expect(prisma.walletTransaction.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: expect.stringContaining('WITHDRAWAL_FAILED'),
        }),
      }),
    );
  });

  it('retries instead of completing when Chapa credentials are missing', async () => {
    const { processor, prisma, config, chapaClient } = buildProcessor();
    config.get.mockReturnValueOnce(undefined);

    await expect(processor.process(withdrawalJob)).rejects.toThrow(
      'Chapa secret is not configured for withdrawal tx-001',
    );

    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.update).not.toHaveBeenCalled();
  });

  it('does not call Chapa again when another worker already claimed the withdrawal', async () => {
    const { processor, chapaClient } = buildProcessor(
      'WITHDRAWAL_PROCESSING - Withdrawal of 10 USD via CHAPA - pending Chapa payout of ETB 1205',
    );

    await expect(processor.process(withdrawalJob)).rejects.toThrow(
      'already being processed; waiting for provider reconciliation',
    );

    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
    expect(chapaClient.verifyTransfer).toHaveBeenCalledWith('tx-001');
  });

  it('marks a processing withdrawal submitted when Chapa verification already succeeded', async () => {
    const { processor, prisma, chapaClient } = buildProcessor(
      'WITHDRAWAL_PROCESSING - Withdrawal of 10 USD via CHAPA - pending Chapa payout of ETB 1205',
    );
    chapaClient.verifyTransfer.mockResolvedValueOnce({
      status: 'success',
      data: { status: 'success', reference: 'provider-ref-001' },
    });

    await processor.process(withdrawalJob);

    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-001' },
        data: expect.objectContaining({
          note: expect.stringContaining('WITHDRAWAL_SUBMITTED'),
        }),
      }),
    );
  });
});

describe('WalletProcessor pending releases', () => {
  const releaseJob = {
    id: 'release:milestone-1',
    name: WALLET_JOBS.RELEASE_PENDING,
    data: {
      walletId: 'wallet-user-001',
      userId: 'user-001',
      amount: 900,
      milestoneId: 'milestone-1',
    },
  } as Job;

  it('releases pending funds inside one idempotent transaction', async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(releaseJob);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.eventLog.findFirst).toHaveBeenCalledWith({
      where: { eventType: 'wallet.pending_released', entityId: 'milestone-1' },
    });
    expect(prisma.freelancerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-user-001' },
      data: {
        pendingBalance: { decrement: 900 },
        availableBalance: { increment: 900 },
      },
    });
    expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT_AVAILABLE',
          amount: 900,
          milestoneId: 'milestone-1',
        }),
      }),
    );
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'wallet.pending_released',
          entityId: 'milestone-1',
        }),
      }),
    );
  });

  it('skips duplicate pending-release retries after the event marker exists', async () => {
    const { processor, prisma } = buildProcessor();
    prisma.eventLog.findFirst.mockResolvedValueOnce({ id: 'event-1' });

    await processor.process(releaseJob);

    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    expect(prisma.eventLog.create).not.toHaveBeenCalled();
  });
});
