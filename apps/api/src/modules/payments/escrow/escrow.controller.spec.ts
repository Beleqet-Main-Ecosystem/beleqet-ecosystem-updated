import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
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

  it('registers Chapa’s GET callback as its own route (it used to be lost, giving 404)', () => {
    const route = (handler: unknown) => ({
      path: Reflect.getMetadata(PATH_METADATA, handler as object),
      method: Reflect.getMetadata(METHOD_METADATA, handler as object),
    });
    expect(route(EscrowController.prototype.callback)).toEqual({
      path: 'callback',
      method: RequestMethod.GET,
    });
    expect(route(EscrowController.prototype.webhook)).toEqual({
      path: 'callback',
      method: RequestMethod.POST,
    });
  });
});

describe('EscrowController Chapa GET callback', () => {
  it('queues a check for the payment Chapa names, without needing a signature', async () => {
    const { controller, svc, signatures } = buildController();
    await expect(
      controller.callback({ trx_ref: 'CHAPA-1', ref_id: 'AP1', status: 'success' }),
    ).resolves.toEqual({ received: true });
    expect(signatures.verifyWebhook).not.toHaveBeenCalled();
    expect(svc.handleWebhook).toHaveBeenCalledWith({
      tx_ref: 'CHAPA-1',
      reference: 'AP1',
      status: 'success',
    });
  });

  it('ignores a call that names no payment', async () => {
    const { controller, svc } = buildController();
    await expect(controller.callback({ status: 'success' })).resolves.toEqual({ received: false });
    expect(svc.handleWebhook).not.toHaveBeenCalled();
  });

  it('ignores extra query fields such as the JSONP callback name', async () => {
    const { controller, svc } = buildController();
    await controller.callback({
      callback: 'jQuery1',
      trx_ref: 'CHAPA-1',
      status: 'success',
      _: '1',
    });
    expect(svc.handleWebhook).toHaveBeenCalledWith({
      tx_ref: 'CHAPA-1',
      reference: 'CHAPA-1',
      status: 'success',
    });
  });
});
