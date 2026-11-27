import { createHmac } from 'crypto';
import { verifyBeleqetPayWebhook } from './webhook-signature';

// The two signed examples in Beleqet Pay's contract for Jobs (made with a fake secret).
const SECRET = 'whsec_example_not_a_real_secret';
const PAYMENT =
  '{"id":"evt_5f1c0a9e2b7d4c38a1e6f702","event":"payment.success","timestamp":1796025600,"createdAt":"2026-12-01T09:20:00.000Z","data":{"transactionId":"3b8f2c1e-7a4d-4e9b-9c2f-1d5e6a7b8c9d","txRef":"TX-BLQ-4F2A91C0","amount":"999.00","grossAmount":"999.00","netAmount":"999.00","fee":"0.00","currency":"ETB","provider":"CHAPA","livemode":true,"status":"SUCCESS","settledAt":"2026-12-01T09:20:00.000Z","metadata":{"app":"beleqet-jobs","planPaymentId":"cm4x9k2p0001","customerEmail":"employer@example.com"}}}';
const PAYMENT_SIGNATURE = 'sha256=d1c73465cc083a34e4415cf0435cf16c32c93035c9a2124a0fdbc340da03e375';
const TRANSFER =
  '{"id":"evt_9a2b7c4d1e0f3a6b5c8d7e2f","event":"transfer.succeeded","timestamp":1796029200,"createdAt":"2026-12-01T10:19:30.000Z","data":{"transferId":"6e1d2c3b-4a59-4876-9c3d-2e1f0a9b8c7d","transferRef":"TR-BLQ-7B707792","reference":"wd_cm4xa1b2c0003","narration":"Beleqet Jobs withdrawal","amount":"1500.00","currency":"ETB","livemode":true,"status":"SUCCEEDED","failureReason":null,"bankCode":"855","accountLast4":"3344"}}';
const TRANSFER_SIGNATURE =
  'sha256=d7602b7547fac707d4a0f68bf137d8f24fa3c0c2daa8334a361b495319afcc5a';

describe('verifyBeleqetPayWebhook', () => {
  it("accepts Pay's own signed examples", () => {
    const payment = verifyBeleqetPayWebhook(
      Buffer.from(PAYMENT),
      PAYMENT_SIGNATURE,
      SECRET,
      1796025600,
    );
    expect(payment).toMatchObject({
      id: 'evt_5f1c0a9e2b7d4c38a1e6f702',
      event: 'payment.success',
      data: { txRef: 'TX-BLQ-4F2A91C0', metadata: { planPaymentId: 'cm4x9k2p0001' } },
    });
    const transfer = verifyBeleqetPayWebhook(
      Buffer.from(TRANSFER),
      TRANSFER_SIGNATURE,
      SECRET,
      1796029200 + 60,
    );
    expect(transfer).toMatchObject({
      event: 'transfer.succeeded',
      data: { reference: 'wd_cm4xa1b2c0003' },
    });
  });

  it('refuses a wrong secret, a changed body or a missing signature', () => {
    const at = 1796025600;
    expect(
      verifyBeleqetPayWebhook(Buffer.from(PAYMENT), PAYMENT_SIGNATURE, 'whsec_other', at),
    ).toBeNull();
    const changed = PAYMENT.replace('"999.00","grossAmount"', '"1.00","grossAmount"');
    expect(verifyBeleqetPayWebhook(Buffer.from(changed), PAYMENT_SIGNATURE, SECRET, at)).toBeNull();
    expect(verifyBeleqetPayWebhook(Buffer.from(PAYMENT), undefined, SECRET, at)).toBeNull();
    expect(verifyBeleqetPayWebhook(Buffer.from(PAYMENT), PAYMENT_SIGNATURE, '', at)).toBeNull();
  });

  it('refuses an event signed more than 5 minutes away from now, even with a good signature', () => {
    expect(
      verifyBeleqetPayWebhook(Buffer.from(PAYMENT), PAYMENT_SIGNATURE, SECRET, 1796025600 + 301),
    ).toBeNull();
    expect(
      verifyBeleqetPayWebhook(Buffer.from(PAYMENT), PAYMENT_SIGNATURE, SECRET, 1796025600 - 301),
    ).toBeNull();
  });

  it('refuses a signed body that is not an event', () => {
    const body = Buffer.from('{"hello":"world"}');
    const signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
    expect(verifyBeleqetPayWebhook(body, signature, SECRET)).toBeNull();
  });
});
