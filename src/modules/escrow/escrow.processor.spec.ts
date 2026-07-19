import { Job } from 'bullmq';
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

  const prisma = {
    eventLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => Promise.resolve(input)),
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
      findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      update: jest.fn((input) => Promise.resolve(input)),
    },
    employerWalletTransaction: {
      create: jest.fn((input) => Promise.resolve(input)),
    },
    $transaction: jest.fn(async (items: Promise<unknown>[]) => Promise.all(items)),
  };

  const chapaClient = {
    verifyTransaction: jest.fn().mockResolvedValue({
      status: 'success',
      data: {
        status: 'success',
        tx_ref: 'tx-1',
        amount: '900',
        currency: 'ETB',
      },
    }),
  };

  const notificationsQueue = { add: jest.fn() };
  const escrowQueue = { add: jest.fn() };
  const processor = new EscrowProcessor(
    prisma as never,
    { get: jest.fn(() => 'http://localhost:3000') } as never,
    chapaClient as never,
    notificationsQueue as never,
    escrowQueue as never,
  );

  return { processor, prisma, chapaClient, notificationsQueue };
}

describe('EscrowProcessor', () => {
  it('verifies Chapa before marking escrow funded', async () => {
    const { processor, prisma, chapaClient, notificationsQueue } = buildProcessor();

    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: 'tx-1', reference: 'chapa-ref', status: 'success' },
    } as Job);

    expect(chapaClient.verifyTransaction).toHaveBeenCalledWith('tx-1');
    expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FUNDED' }) }),
    );
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'chapa.webhook.processed' }) }),
    );
    expect(notificationsQueue.add).toHaveBeenCalled();
  });

  it('skips duplicate webhook events', async () => {
    const { processor, prisma, chapaClient } = buildProcessor();
    prisma.eventLog.findFirst.mockResolvedValueOnce({ id: 'event-1' });

    await processor.handleWebhook({
      data: { event: 'charge.success', tx_ref: 'tx-1', reference: 'chapa-ref', status: 'success' },
    } as Job);

    expect(chapaClient.verifyTransaction).not.toHaveBeenCalled();
  });
});
