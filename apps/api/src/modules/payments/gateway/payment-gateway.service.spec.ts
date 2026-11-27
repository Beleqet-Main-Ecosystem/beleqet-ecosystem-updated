import { BeleqetPayError } from '../beleqet-pay/beleqet-pay.service';
import { PaymentGateway } from './payment-gateway.service';

function build(via?: string) {
  const chapa = {
    checkoutUrl: jest.fn().mockResolvedValue('https://checkout.chapa.co/c/1'),
    paymentResult: jest
      .fn()
      .mockResolvedValue({ state: 'success', amount: 999, currency: 'ETB', raw: {} }),
    banks: jest
      .fn()
      .mockResolvedValue([{ code: '855', name: 'telebirr', accountLength: 10, mobileMoney: true }]),
  };
  const pay = {
    isConfigured: jest.fn().mockReturnValue(true),
    createCheckoutSession: jest.fn().mockResolvedValue({
      txRef: 'TX-BLQ-1',
      checkoutUrl: 'https://beleqetpay.com/v1/checkout/test/TX-BLQ-1',
    }),
    getTransaction: jest.fn(),
    banks: jest.fn().mockResolvedValue([
      {
        code: 946,
        name: 'Commercial Bank of Ethiopia (CBE)',
        mobileMoney: false,
        accountLength: 13,
      },
    ]),
    createTransfer: jest.fn(),
    getTransfer: jest.fn(),
  };
  const gateway = new PaymentGateway(
    { get: (key: string) => (key === 'PAYMENTS_VIA' ? via : undefined) } as never,
    chapa as never,
    pay as never,
  );
  return { gateway, chapa, pay };
}

const checkout = {
  amount: '999.00',
  currency: 'ETB',
  email: 'e@example.com',
  firstName: 'Abebe',
  lastName: 'Kebede',
  returnUrl: 'https://web/back',
  title: 'Beleqet Jobs',
  description: 'Pro plan',
  reference: 'CHAPA-1',
  metadata: { kind: 'plan', planPaymentId: 'p1' },
};

describe('PaymentGateway', () => {
  it('uses Chapa unless PAYMENTS_VIA says beleqet_pay', () => {
    expect(build().gateway.current()).toBe('chapa');
    expect(build('chapa').gateway.current()).toBe('chapa');
    expect(build('something').gateway.current()).toBe('chapa');
    expect(build(' Beleqet_Pay ').gateway.current()).toBe('beleqet_pay');
  });

  it('opens Chapa with our reference as its tx_ref', async () => {
    const { gateway, chapa, pay } = build();
    await expect(gateway.openCheckout(checkout)).resolves.toEqual({
      checkoutUrl: 'https://checkout.chapa.co/c/1',
      providerRef: 'CHAPA-1',
    });
    expect(chapa.checkoutUrl).toHaveBeenCalledWith(expect.objectContaining({ txRef: 'CHAPA-1' }));
    expect(pay.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("opens Pay with our reference as the idempotency key and keeps Pay's txRef", async () => {
    const { gateway, chapa, pay } = build('beleqet_pay');
    await expect(gateway.openCheckout(checkout)).resolves.toEqual({
      checkoutUrl: 'https://beleqetpay.com/v1/checkout/test/TX-BLQ-1',
      providerRef: 'TX-BLQ-1',
    });
    expect(pay.createCheckoutSession).toHaveBeenCalledWith(
      {
        amount: '999.00',
        currency: 'ETB',
        customerEmail: 'e@example.com',
        successRedirectUrl: 'https://web/back',
        metadata: { app: 'beleqet-jobs', kind: 'plan', planPaymentId: 'p1' },
      },
      'CHAPA-1',
    );
    expect(chapa.checkoutUrl).not.toHaveBeenCalled();
  });

  it('checks each payment with the provider that made it, whatever the switch says', async () => {
    const { gateway, chapa, pay } = build('chapa');
    pay.getTransaction.mockResolvedValue({
      txRef: 'TX-BLQ-1',
      status: 'SUCCESS',
      amount: '999',
      currency: 'ETB',
      metadata: { planPaymentId: 'p1' },
    });
    await expect(gateway.paymentResult('TX-BLQ-1')).resolves.toMatchObject({
      state: 'success',
      amount: 999,
      currency: 'ETB',
      metadata: { planPaymentId: 'p1' },
    });
    await gateway.paymentResult('CHAPA-1');
    expect(chapa.paymentResult).toHaveBeenCalledWith('CHAPA-1');
  });

  it("reads Pay's statuses: only SUCCESS is paid, PENDING waits, the rest failed", async () => {
    const { gateway, pay } = build('beleqet_pay');
    for (const [status, state] of [
      ['SUCCESS', 'success'],
      ['PENDING', 'pending'],
      ['EXPIRED', 'failed'],
      ['FAILED', 'failed'],
      ['REFUNDED', 'failed'],
    ]) {
      pay.getTransaction.mockResolvedValue({ status, amount: '999', currency: 'ETB' });
      await expect(gateway.paymentResult('TX-BLQ-1')).resolves.toMatchObject({ state });
    }
  });

  it("gives Pay's bank list in Chapa's shape, codes as text", async () => {
    await expect(build('beleqet_pay').gateway.banks()).resolves.toEqual([
      {
        code: '946',
        name: 'Commercial Bank of Ethiopia (CBE)',
        accountLength: 13,
        mobileMoney: false,
      },
    ]);
    const { gateway, chapa } = build();
    await gateway.banks();
    expect(chapa.banks).toHaveBeenCalled();
  });

  it('sends payouts in birr and reads where they stand', async () => {
    const { gateway, pay } = build('beleqet_pay');
    pay.createTransfer.mockResolvedValue({
      transferRef: 'TR-BLQ-1',
      status: 'PENDING',
      submittedAt: '2026-11-27T10:00:00.000Z',
      sendBy: null,
      destination: { bankName: 'telebirr' },
    });
    await expect(
      gateway.sendPayout({
        reference: 'wd_1',
        amount: 1500,
        bankCode: '855',
        accountNumber: '0911223344',
        accountName: 'Abebe Kebede',
      }),
    ).resolves.toEqual({
      state: 'pending',
      providerRef: 'TR-BLQ-1',
      bankName: 'telebirr',
      sent: true,
      sendBy: null,
    });
    expect(pay.createTransfer).toHaveBeenCalledWith({
      reference: 'wd_1',
      amount: '1500.00',
      bankCode: '855',
      accountNumber: '0911223344',
      accountName: 'Abebe Kebede',
      narration: 'Beleqet Jobs withdrawal',
    });

    // Not handed to Chapa yet: waiting for Pay's Chapa balance until sendBy.
    pay.getTransfer.mockResolvedValue({
      transferRef: 'TR-BLQ-1',
      status: 'PENDING',
      submittedAt: null,
      sendBy: '2026-11-30T10:00:00.000Z',
    });
    await expect(gateway.payoutStatus('wd_1')).resolves.toMatchObject({
      state: 'pending',
      sent: false,
      sendBy: '2026-11-30T10:00:00.000Z',
    });
    pay.getTransfer.mockResolvedValue({ transferRef: 'TR-BLQ-1', status: 'SUCCEEDED' });
    await expect(gateway.payoutStatus('wd_1')).resolves.toMatchObject({ state: 'paid' });
    pay.getTransfer.mockResolvedValue({
      transferRef: 'TR-BLQ-1',
      status: 'FAILED',
      failureReason: 'Account closed',
    });
    await expect(gateway.payoutStatus('wd_1')).resolves.toEqual({
      state: 'failed',
      providerRef: 'TR-BLQ-1',
      reason: 'Account closed',
    });
  });

  it('turns a refused payout into failed, and lets an outage throw so it is retried', async () => {
    const { gateway, pay } = build('beleqet_pay');
    const request = {
      reference: 'wd_1',
      amount: 10,
      bankCode: '855',
      accountNumber: '0911223344',
      accountName: 'Ab',
    };
    pay.createTransfer.mockRejectedValueOnce(new BeleqetPayError('Daily limit reached', 400));
    await expect(gateway.sendPayout(request)).resolves.toEqual({
      state: 'failed',
      reason: 'Daily limit reached',
    });
    pay.createTransfer.mockRejectedValueOnce(
      new BeleqetPayError('Beleqet Pay is unreachable', 502),
    );
    await expect(gateway.sendPayout(request)).rejects.toThrow('unreachable');
  });
});
