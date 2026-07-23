import { Job } from 'bullmq';
import { WalletProcessor } from './wallet.processor';
import { WALLET_JOBS } from '../queues/queues.constants';

function buildProcessor(
  note = 'Withdrawal of 10 USD via CHAPA - pending Chapa payout of ETB 1205',
) {
  const withdrawal = {
    id: 'tx-001',
    walletId: 'wallet-user-001',
    amount: 1205,
    type: 'DEBIT_WITHDRAWAL',
    note,
  };

  const prisma: any = {
    freelancerWallet: {
      update: jest.fn().mockResolvedValue({ id: 'wallet-user-001' }),
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
    expect(prisma.walletTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'tx-001',
          NOT: expect.arrayContaining([
            { note: { contains: 'Chapa transfer submitted' } },
            { note: { contains: 'Withdrawal FAILED' } },
          ]),
        }),
        data: { note: 'Withdrawal FAILED: Invalid account number' },
      }),
    );
  });

  it('skips duplicate jobs after the withdrawal is finalized', async () => {
    const { processor, chapaClient } = buildProcessor(
      'Withdrawal via CHAPA - Chapa transfer submitted (provider-ref-001)',
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
    prisma.walletTransaction.updateMany.mockResolvedValueOnce({ count: 0 });

    await processor.process(withdrawalJob);

    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
  });

  it('lets transient Chapa errors retry without restoring reserved funds', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    chapaClient.createTransfer.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(processor.process(withdrawalJob)).rejects.toThrow('ECONNRESET');

    expect(prisma.freelancerWallet.update).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.update).not.toHaveBeenCalled();
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
});
