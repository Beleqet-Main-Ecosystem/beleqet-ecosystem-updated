import { CampaignPaymentService } from './campaign-payment.service';

describe('CampaignPaymentService webhook → activation', () => {
  const prisma = {
    eventLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    campaign: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employerWallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const chapa = {
    verifyTransaction: jest.fn().mockResolvedValue({ status: 'success' }),
  };

  const wallet = {
    convertCurrency: jest.fn((amount: number) => amount),
    getExchangeRate: jest.fn(() => 1),
  };

  const service = new CampaignPaymentService(
    prisma as never,
    wallet as never,
    chapa as never,
    { get: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
  });

  it('activates PENDING_PAYMENT campaign on successful Chapa webhook', async () => {
    prisma.eventLog.findFirst.mockResolvedValue(null);
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      ownerId: 'user-1',
      status: 'PENDING_PAYMENT',
      paymentTxRef: 'tx-abc',
      currencyCode: 'ETB',
      totalBudget: 1000,
      reservedAmountEtb: 1000,
      startAt: null,
    });
    prisma.campaign.update.mockResolvedValue({ id: 'camp-1', status: 'ACTIVE' });
    prisma.employerWallet.findUnique.mockResolvedValue(null);

    const result = await service.handlePaymentWebhook({
      tx_ref: 'tx-abc',
      status: 'success',
    });

    expect(result).toEqual({ ok: true, campaignId: 'camp-1', status: 'ACTIVE' });
    expect(chapa.verifyTransaction).toHaveBeenCalledWith('tx-abc');
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('rejects campaign and releases wallet lock on failed payment', async () => {
    prisma.eventLog.findFirst.mockResolvedValue(null);
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'camp-2',
      ownerId: 'user-1',
      status: 'PENDING_PAYMENT',
      paymentTxRef: 'tx-fail',
      currencyCode: 'ETB',
      totalBudget: 1000,
      reservedAmountEtb: 400,
      startAt: null,
    });
    prisma.employerWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.campaign.update.mockResolvedValue({ id: 'camp-2', status: 'REJECTED' });

    const result = await service.handlePaymentWebhook({
      tx_ref: 'tx-fail',
      status: 'failed',
    });

    expect(result.status).toBe('REJECTED');
    expect(prisma.employerWallet.updateMany).toHaveBeenCalled();
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reservedAmountEtb: 0 }),
      }),
    );
  });

  it('is idempotent when webhook was already processed', async () => {
    prisma.eventLog.findFirst.mockResolvedValue({ id: 'existing' });
    const result = await service.handlePaymentWebhook({ tx_ref: 'tx-abc', status: 'success' });
    expect(result).toEqual({ ok: true });
    expect(prisma.campaign.findFirst).not.toHaveBeenCalled();
  });
});
