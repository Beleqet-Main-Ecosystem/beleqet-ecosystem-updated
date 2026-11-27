import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ESCROW_JOBS, WALLET_JOBS } from '../../platform/queues/queues.constants';
import { BeleqetPayWebhookController } from './beleqet-pay-webhook.controller';

const SECRET = 'whsec_test';

function build() {
  const prisma = {
    eventLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const escrowQueue = { add: jest.fn().mockResolvedValue({}) };
  const walletQueue = { add: jest.fn().mockResolvedValue({}) };
  const controller = new BeleqetPayWebhookController(
    { get: (key: string) => (key === 'BELEQET_PAY_WEBHOOK_SECRET' ? SECRET : undefined) } as never,
    prisma as never,
    escrowQueue as never,
    walletQueue as never,
  );
  return { controller, prisma, escrowQueue, walletQueue };
}

/** A request as Pay sends it: the raw body and its signature. */
function signed(event: string, data: Record<string, unknown>, id = 'evt_1', secret = SECRET) {
  const body = Buffer.from(
    JSON.stringify({ id, event, timestamp: Math.floor(Date.now() / 1000), data }),
  );
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  return [{ rawBody: body } as never, signature] as const;
}

describe('BeleqetPayWebhookController', () => {
  it('queues a payment for the escrow or plan payment named in its metadata', async () => {
    const { controller, escrowQueue, prisma } = build();
    await expect(
      controller.webhook(
        ...signed('payment.success', { txRef: 'TX-BLQ-1', metadata: { planPaymentId: 'pay-1' } }),
      ),
    ).resolves.toEqual({ received: true });
    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.PROCESS_WEBHOOK,
      {
        tx_ref: 'TX-BLQ-1',
        reference: 'TX-BLQ-1',
        externalRef: 'pay-1',
        event: 'payment.success',
        status: 'success',
        source: 'beleqet_pay',
      },
      expect.objectContaining({ jobId: 'beleqet-pay-evt_1', attempts: 5 }),
    );
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'beleqet_pay.webhook', entityId: 'evt_1' }),
      }),
    );
  });

  it('tells expired from failed payments', async () => {
    const { controller, escrowQueue } = build();
    await controller.webhook(...signed('payment.expired', { txRef: 'TX-BLQ-1' }, 'evt_2'));
    await controller.webhook(...signed('payment.failed', { txRef: 'TX-BLQ-1' }, 'evt_3'));
    expect(escrowQueue.add.mock.calls.map(([, job]) => job.status)).toEqual(['expired', 'failed']);
  });

  it('queues a payout result for the withdrawal', async () => {
    const { controller, walletQueue, escrowQueue } = build();
    await controller.webhook(...signed('transfer.failed', { reference: 'wd_tx-1' }));
    expect(walletQueue.add).toHaveBeenCalledWith(
      WALLET_JOBS.PAYOUT_RESULT,
      { reference: 'wd_tx-1' },
      expect.objectContaining({ jobId: 'beleqet-pay-evt_1' }),
    );
    expect(escrowQueue.add).not.toHaveBeenCalled();
  });

  it('handles each event once', async () => {
    const { controller, prisma, escrowQueue } = build();
    prisma.eventLog.findFirst.mockResolvedValue({ id: 'seen' });
    await expect(
      controller.webhook(...signed('payment.success', { txRef: 'TX-BLQ-1' })),
    ).resolves.toEqual({ received: true });
    expect(escrowQueue.add).not.toHaveBeenCalled();
  });

  it('acknowledges refund and dispute events without acting', async () => {
    const { controller, escrowQueue, walletQueue } = build();
    await controller.webhook(...signed('refund.succeeded', { txRef: 'TX-BLQ-1' }));
    expect(escrowQueue.add).not.toHaveBeenCalled();
    expect(walletQueue.add).not.toHaveBeenCalled();
  });

  it('refuses anything not signed with our secret', async () => {
    const { controller, escrowQueue, prisma } = build();
    const [request] = signed('payment.success', { txRef: 'TX-BLQ-1' });
    await expect(controller.webhook(request, 'sha256=00')).rejects.toThrow(BadRequestException);
    await expect(
      controller.webhook(
        ...signed('payment.success', { txRef: 'TX-BLQ-1' }, 'evt_1', 'whsec_other'),
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(controller.webhook({} as never, 'sha256=00')).rejects.toThrow(BadRequestException);
    expect(escrowQueue.add).not.toHaveBeenCalled();
    expect(prisma.eventLog.findFirst).not.toHaveBeenCalled();
  });
});
