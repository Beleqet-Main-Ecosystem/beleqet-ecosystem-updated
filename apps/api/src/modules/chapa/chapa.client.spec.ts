import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChapaClient } from './chapa.client';

function buildClient(settings: Record<string, string> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'CHAPA_BASE_URL' ? fallback : settings[key],
    ),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'CHAPA_SECRET_KEY') return 'chapa-secret';
      throw new Error(`Missing ${key}`);
    }),
  } as unknown as ConfigService;

  return new ChapaClient(config);
}

describe('ChapaClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates transfers through the shared client', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ status: 'success', data: { reference: 'ref-1' } })),
    });
    global.fetch = fetchMock as never;

    await expect(
      buildClient().createTransfer({
        accountName: 'Freelancer',
        accountNumber: '0911000000',
        amount: '100',
        currency: 'ETB',
        reference: 'withdrawal-1',
        bankCode: '855',
      }),
    ).resolves.toMatchObject({ status: 'success' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transfers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          account_name: 'Freelancer',
          account_number: '0911000000',
          amount: '100',
          currency: 'ETB',
          reference: 'withdrawal-1',
          bank_code: 855,
        }),
      }),
    );
  });

  it('wraps non-JSON provider responses in BadGatewayException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue('<html>bad gateway</html>'),
    }) as never;

    await expect(buildClient().verifyTransaction('tx-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('verifies transfers by reference through the shared client', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ status: 'success', data: { reference: 'tx-001' } })),
    });
    global.fetch = fetchMock as never;

    await expect(buildClient().verifyTransfer('tx-001')).resolves.toMatchObject({
      status: 'success',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transfers/verify/tx-001',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  const reply = (body: unknown, ok = true) =>
    jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    });

  const checkout = {
    amount: '999.00',
    currency: 'ETB',
    email: 'emp@example.com',
    firstName: 'Abebe',
    lastName: 'Kebede',
    txRef: 'CHAPA-1',
    returnUrl: 'https://web.test/employer?tab=plan&payment=p1',
    title: 'Beleqet Jobs Marketplace',
    description: 'Pro plan (monthly) & more!',
  };

  it('opens a checkout with the callback address and Chapa-safe title and description', async () => {
    const fetchMock = reply({
      status: 'success',
      data: { checkout_url: 'https://checkout.chapa.co/checkout/payment/abc' },
    });
    global.fetch = fetchMock as never;

    await expect(
      buildClient({ APP_BASE_URL: 'https://api.test/api/v1/' }).checkoutUrl(checkout),
    ).resolves.toBe('https://checkout.chapa.co/checkout/payment/abc');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.chapa.co/v1/transaction/initialize');
    expect(body).toMatchObject({
      amount: '999.00',
      tx_ref: 'CHAPA-1',
      callback_url: 'https://api.test/api/v1/escrow/callback',
      return_url: checkout.returnUrl,
      customization: { title: 'Beleqet Jobs Mar', description: 'Pro plan monthly  more' },
    });
  });

  it('prefers CHAPA_CALLBACK_URL when it is set', async () => {
    const fetchMock = reply({ status: 'success', data: { checkout_url: 'https://c.test/x' } });
    global.fetch = fetchMock as never;
    await buildClient({
      APP_BASE_URL: 'https://api.test/api/v1',
      CHAPA_CALLBACK_URL: 'https://hooks.test/chapa',
    }).checkoutUrl(checkout);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).callback_url).toBe(
      'https://hooks.test/chapa',
    );
  });

  it('fails clearly when Chapa refuses the checkout', async () => {
    global.fetch = reply({ status: 'failed', message: 'Invalid currency' }, false) as never;
    await expect(buildClient().checkoutUrl(checkout)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('fails when Chapa answers without a payment page', async () => {
    global.fetch = reply({ status: 'success', data: {} }) as never;
    await expect(buildClient().checkoutUrl(checkout)).rejects.toThrow('payment page');
  });

  it.each([
    ['success', 'success'],
    ['pending', 'pending'],
    ['failed', 'failed'],
    ['cancelled', 'failed'],
  ])('reads Chapa status %s as %s', async (chapaStatus, state) => {
    global.fetch = reply({
      status: 'success',
      data: { status: chapaStatus, amount: '999.00', currency: 'ETB', tx_ref: 'CHAPA-1' },
    }) as never;
    await expect(buildClient().paymentResult('CHAPA-1')).resolves.toMatchObject({
      state,
      amount: 999,
      currency: 'ETB',
    });
  });

  it('lists active ETB banks by name, as codes the transfer takes', async () => {
    const fetchMock = reply({
      status: 'success',
      data: [
        {
          id: 855,
          name: 'telebirr',
          acct_length: 10,
          is_mobilemoney: 1,
          active: 1,
          currency: 'ETB',
        },
        {
          id: 867,
          name: 'YaYaWallet',
          acct_length: 12,
          is_mobilemoney: 1,
          active: null,
          currency: 'ETB',
        },
        {
          id: 534,
          name: 'Hibret Bank',
          acct_length: 16,
          is_mobilemoney: null,
          active: 1,
          currency: 'ETB',
        },
      ],
    });
    global.fetch = fetchMock as never;
    const client = buildClient();
    await expect(client.banks()).resolves.toEqual([
      { code: '534', name: 'Hibret Bank', accountLength: 16, mobileMoney: false },
      { code: '855', name: 'telebirr', accountLength: 10, mobileMoney: true },
    ]);
    await client.banks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.chapa.co/v1/banks');
  });
});
