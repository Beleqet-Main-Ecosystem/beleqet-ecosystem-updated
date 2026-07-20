import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChapaClient } from './chapa.client';

function buildClient() {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'CHAPA_BASE_URL' ? fallback : undefined,
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
          bank_code: '855',
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
});
