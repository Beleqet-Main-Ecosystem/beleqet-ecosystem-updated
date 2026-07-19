import { ConfigService } from '@nestjs/config';
import { ChapaSignatureService } from './chapa-signature.service';

describe('ChapaSignatureService', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'CHAPA_WEBHOOK_SECRET' ? 'webhook-secret' : undefined)),
  } as unknown as ConfigService;
  const service = new ChapaSignatureService(config);
  const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', tx_ref: 'tx-1' }));

  it('accepts a valid x-chapa-signature payload HMAC', () => {
    const signature = service.hmac(rawBody.toString('utf8'), 'webhook-secret');

    expect(service.verifyWebhook(rawBody, { 'x-chapa-signature': signature })).toBe(true);
  });

  it('accepts a valid chapa-signature secret HMAC', () => {
    const signature = service.hmac('webhook-secret', 'webhook-secret');

    expect(service.verifyWebhook(rawBody, { 'chapa-signature': signature })).toBe(true);
  });

  it('rejects invalid signatures', () => {
    expect(service.verifyWebhook(rawBody, { 'x-chapa-signature': '0'.repeat(64) })).toBe(false);
  });
});
