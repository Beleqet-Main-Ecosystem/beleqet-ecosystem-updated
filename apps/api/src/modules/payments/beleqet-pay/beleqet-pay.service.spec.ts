import { BeleqetPayError, BeleqetPayService, isBeleqetPayRef } from './beleqet-pay.service';

describe('BeleqetPayService', () => {
  const settings: Record<string, string | undefined> = {};
  const service = new BeleqetPayService({ get: (key: string) => settings[key] } as never);
  const fetchMock = jest.spyOn(global, 'fetch');
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    fetchMock.mockReset();
    settings.BELEQET_PAY_API_URL = 'http://beleqet-pay-api:4001';
    settings.BELEQET_PAY_SERVICE_KEY = 'blq_test_key';
  });
  afterAll(() => fetchMock.mockRestore());

  it('creates a checkout with the key, an idempotency key and birr amounts', async () => {
    fetchMock.mockResolvedValue(reply(201, { txRef: 'TX-BLQ-1', checkoutUrl: 'https://pay/c' }));
    const request = {
      amount: '999.00',
      currency: 'ETB',
      customerEmail: 'e@example.com',
      successRedirectUrl: 'https://web/back',
      metadata: { planPaymentId: 'p1' },
    };

    await expect(service.createCheckoutSession(request, 'plan-p1')).resolves.toMatchObject({
      txRef: 'TX-BLQ-1',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://beleqet-pay-api:4001/v1/checkout/sessions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer blq_test_key',
      'Idempotency-Key': 'plan-p1',
    });
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it('takes the address with or without /v1, and uses the reference as the payout idempotency key', async () => {
    settings.BELEQET_PAY_API_URL = 'https://beleqetpay.com/v1/';
    fetchMock.mockResolvedValue(reply(201, { status: 'PENDING' }));
    await service.createTransfer({
      reference: 'wd_1',
      amount: '10.00',
      bankCode: '855',
      accountNumber: '0911223344',
      accountName: 'Abebe',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beleqetpay.com/v1/transfers');
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'wd_1' });
  });

  it('says what Pay refused, and tells a refusal from a conflict or an outage', async () => {
    fetchMock.mockResolvedValueOnce(reply(403, { message: 'Transfers are not switched on' }));
    const refused = await service.getTransfer('wd_1').catch((err: BeleqetPayError) => err);
    expect(refused).toBeInstanceOf(BeleqetPayError);
    expect((refused as BeleqetPayError).message).toBe('Transfers are not switched on');
    expect((refused as BeleqetPayError).refused).toBe(true);

    fetchMock.mockResolvedValueOnce(reply(409, { message: ['still running'] }));
    const conflict = (await service.getTransfer('wd_1').catch((err) => err)) as BeleqetPayError;
    expect(conflict.refused).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const down = (await service.getTransfer('wd_1').catch((err) => err)) as BeleqetPayError;
    expect(down.payStatus).toBe(502);
    expect(down.refused).toBe(false);
  });

  it('asks nothing without a key', async () => {
    settings.BELEQET_PAY_SERVICE_KEY = '';
    expect(service.isConfigured()).toBe(false);
    await expect(service.banks()).rejects.toThrow('not set up');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("knows Pay's references", () => {
    expect(isBeleqetPayRef('TX-BLQ-4F2A91C0')).toBe(true);
    expect(isBeleqetPayRef('CHAPA-1')).toBe(false);
    expect(isBeleqetPayRef(null)).toBe(false);
  });
});
