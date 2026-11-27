import { Job } from 'bullmq';
import { WalletProcessor } from './wallet.processor';
import { WALLET_JOBS } from '../../platform/queues/queues.constants';

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

  const processor = new WalletProcessor(
    prisma as never,
    config as never,
    chapaClient as never,
    {} as never,
    { add: jest.fn().mockResolvedValue({}) } as never,
  );
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
    method: 'Hibret Bank',
    bankCode: '534',
    accountName: 'Selam Tesfaye',
    accountNumber: '1000123456789012',
  },
} as Job;

/** A withdrawal queued before banks were chosen (method + accountRef only). */
const legacyJob = (method: string) =>
  ({
    ...withdrawalJob,
    data: {
      ...withdrawalJob.data,
      method,
      bankCode: undefined,
      accountName: undefined,
      accountNumber: undefined,
      accountRef: '0912345678',
    },
  }) as Job;

describe('WalletProcessor withdrawals', () => {
  it('submits the ETB-converted payout amount to Chapa using the ledger id reference', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();

    await processor.process(withdrawalJob);

    expect(chapaClient.createTransfer).toHaveBeenCalledWith({
      accountName: 'Selam Tesfaye',
      accountNumber: '1000123456789012',
      amount: '1205',
      currency: 'ETB',
      reference: 'tx-001',
      bankCode: '534',
    });
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-001' },
        data: expect.objectContaining({
          note: expect.stringContaining('Chapa transfer submitted'),
        }),
      }),
    );
  });

  it('sends an older telebirr request to telebirr (855)', async () => {
    const { processor, chapaClient } = buildProcessor();
    await processor.process(legacyJob('TELEBIRR'));
    expect(chapaClient.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ bankCode: '855', accountNumber: '0912345678' }),
    );
  });

  it('gives the money back for an older request that never named a bank', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    await processor.process(legacyJob('CHAPA'));
    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
    expect(prisma.freelancerWallet.update).toHaveBeenCalledWith({
      where: { userId: 'user-001' },
      data: { availableBalance: { increment: 1205 } },
    });
    expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { note: expect.stringContaining('No bank was chosen') },
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

describe('WalletProcessor withdrawals through Beleqet Pay', () => {
  function build(note = 'WITHDRAWAL_PENDING - Withdrawal of 1205 ETB to Hibret Bank — pending') {
    const built = buildProcessor(note);
    built.prisma.walletTransaction.findUnique.mockResolvedValue({
      id: 'tx-001',
      walletId: 'wallet-user-001',
      amount: 1205,
      type: 'DEBIT_WITHDRAWAL',
      note,
      wallet: { userId: 'user-001' },
    });
    const gateway = { sendPayout: jest.fn(), payoutStatus: jest.fn() };
    const notifications = { add: jest.fn().mockResolvedValue({}) };
    const processor = new WalletProcessor(
      built.prisma as never,
      built.config as never,
      built.chapaClient as never,
      gateway as never,
      notifications as never,
    );
    const notes = () =>
      built.prisma.walletTransaction.update.mock.calls.map(
        ([call]: [{ data: { note: string } }]) => call.data.note,
      );
    return { ...built, processor, gateway, notifications, notes };
  }
  const payJob = {
    ...withdrawalJob,
    data: { ...withdrawalJob.data, gateway: 'beleqet_pay' },
  } as Job;
  const resultJob = (reference: string) =>
    ({ name: WALLET_JOBS.PAYOUT_RESULT, data: { reference } }) as Job;
  const refund = {
    where: { id: 'wallet-user-001' },
    data: { availableBalance: { increment: 1205 } },
  };

  it('sends it through Pay with one reference per withdrawal, not through Chapa', async () => {
    const { processor, gateway, chapaClient, prisma, notes } = build();
    gateway.sendPayout.mockResolvedValue({
      state: 'pending',
      providerRef: 'TR-BLQ-1',
      bankName: 'Hibret Bank',
    });

    await processor.process(payJob);

    expect(gateway.sendPayout).toHaveBeenCalledWith({
      reference: 'wd_tx-001',
      amount: 1205,
      bankCode: '534',
      accountNumber: '1000123456789012',
      accountName: 'Selam Tesfaye',
    });
    expect(chapaClient.createTransfer).not.toHaveBeenCalled();
    expect(notes().pop()).toBe(
      'WITHDRAWAL_SUBMITTED - Withdrawal via Hibret Bank - sent through Beleqet Pay (TR-BLQ-1)',
    );
    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
  });

  it('records a payout Pay delivered at once as paid, and tells the freelancer', async () => {
    const { processor, gateway, notifications, notes } = build();
    gateway.sendPayout.mockResolvedValue({ state: 'paid', providerRef: 'TR-BLQ-1' });

    await processor.process(payJob);

    expect(notes().pop()).toContain('WITHDRAWAL_PAID');
    expect(notifications.add).toHaveBeenCalledWith(
      'send-in-app',
      expect.objectContaining({ userId: 'user-001', type: 'wallet.withdrawal_paid' }),
    );
  });

  it('gives the money back when Pay refuses the payout', async () => {
    const { processor, gateway, prisma, notifications, notes } = build();
    gateway.sendPayout.mockResolvedValue({ state: 'failed', reason: 'Transfers are switched off' });

    await processor.process(payJob);

    expect(prisma.freelancerWallet.update).toHaveBeenCalledWith(refund);
    expect(notes().pop()).toBe('WITHDRAWAL_FAILED - Withdrawal FAILED: Transfers are switched off');
    expect(notifications.add).toHaveBeenCalledWith(
      'send-in-app',
      expect.objectContaining({ type: 'wallet.withdrawal_failed' }),
    );
  });

  it('lets a Pay outage retry without giving the money back', async () => {
    const { processor, gateway, prisma } = build();
    gateway.sendPayout.mockRejectedValue(new Error('Beleqet Pay is unreachable'));

    await expect(processor.process(payJob)).rejects.toThrow('unreachable');
    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
  });

  it('sends a claimed withdrawal again after a crash: Pay returns the first transfer', async () => {
    const { processor, gateway } = build(
      'WITHDRAWAL_PROCESSING - Withdrawal of 1205 ETB — pending',
    );
    gateway.sendPayout.mockResolvedValue({ state: 'pending', providerRef: 'TR-BLQ-1' });

    await processor.process(payJob);

    expect(gateway.sendPayout).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'wd_tx-001' }),
    );
  });

  it('gives the money back once when a sent payout fails later', async () => {
    const sent =
      'WITHDRAWAL_SUBMITTED - Withdrawal via Hibret Bank - sent through Beleqet Pay (TR-BLQ-1)';
    const { processor, gateway, prisma } = build(sent);
    gateway.payoutStatus.mockResolvedValue({ state: 'failed', reason: 'Account closed' });

    await processor.process(resultJob('wd_tx-001'));
    expect(gateway.payoutStatus).toHaveBeenCalledWith('wd_tx-001');
    expect(prisma.freelancerWallet.update).toHaveBeenCalledWith(refund);

    // The same result again finds it already failed: no second refund.
    prisma.freelancerWallet.update.mockClear();
    prisma.walletTransaction.findUnique.mockResolvedValue({
      id: 'tx-001',
      walletId: 'wallet-user-001',
      amount: 1205,
      note: 'WITHDRAWAL_FAILED - Withdrawal FAILED: Account closed',
      wallet: { userId: 'user-001' },
    });
    await processor.process(resultJob('wd_tx-001'));
    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
  });

  it("ignores payout results that aren't withdrawals", async () => {
    const { processor, gateway } = build();
    await processor.process(resultJob('something-else'));
    expect(gateway.payoutStatus).not.toHaveBeenCalled();
  });
});
