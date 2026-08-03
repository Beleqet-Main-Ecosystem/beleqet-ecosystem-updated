import { UnauthorizedException } from '@nestjs/common';
import { EscrowController } from './escrow.controller';

function buildController(options: { secret?: string; verified?: boolean } = {}) {
  const svc = {
    handleWebhook: jest.fn().mockResolvedValue({ queued: true }),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'CHAPA_WEBHOOK_SECRET') return options.secret ?? 'webhook-secret';
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    }),
  };
  const signatures = {
    verifyWebhook: jest.fn().mockReturnValue(options.verified ?? true),
  };

  const controller = new EscrowController(svc as never, config as never, signatures as never);
  return { controller, svc, signatures };
}

describe('EscrowController webhook signature checks', () => {
  it('rejects unsigned POST webhooks outside production', async () => {
    const { controller, svc, signatures } = buildController();

    await expect(
      controller.webhook(
        { tx_ref: 'tx-1' },
        { method: 'POST', rawBody: Buffer.from('{}'), query: {} } as never,
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signatures.verifyWebhook).not.toHaveBeenCalled();
    expect(svc.handleWebhook).not.toHaveBeenCalled();
  });

  it('rejects POST webhooks when the signature does not verify', async () => {
    const { controller, svc, signatures } = buildController({ verified: false });

    await expect(
      controller.webhook(
        { tx_ref: 'tx-1' },
        { method: 'POST', rawBody: Buffer.from('{}'), query: {} } as never,
        { 'x-chapa-signature': 'bad-signature' },
        undefined,
        'bad-signature',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signatures.verifyWebhook).toHaveBeenCalled();
    expect(svc.handleWebhook).not.toHaveBeenCalled();
  });

  it('accepts signed POST webhooks', async () => {
    const { controller, svc, signatures } = buildController();

    await expect(
      controller.webhook(
        { tx_ref: 'tx-1' },
        { method: 'POST', rawBody: Buffer.from('{}'), query: {} } as never,
        { 'x-chapa-signature': 'valid-signature' },
        undefined,
        'valid-signature',
      ),
    ).resolves.toEqual({ success: true });

    expect(signatures.verifyWebhook).toHaveBeenCalled();
    expect(svc.handleWebhook).toHaveBeenCalledWith(expect.objectContaining({ tx_ref: 'tx-1' }));
  });

  it('still allows unsigned GET return callbacks', async () => {
    const { controller, svc, signatures } = buildController();

    await expect(
      controller.webhook({}, { method: 'GET', query: { trx_ref: 'tx-1' } } as never, {}),
    ).resolves.toEqual({ url: 'http://localhost:3000/freelance/payment-success' });

    expect(signatures.verifyWebhook).not.toHaveBeenCalled();
    expect(svc.handleWebhook).toHaveBeenCalledWith(expect.objectContaining({ tx_ref: 'tx-1' }));
  });
});
