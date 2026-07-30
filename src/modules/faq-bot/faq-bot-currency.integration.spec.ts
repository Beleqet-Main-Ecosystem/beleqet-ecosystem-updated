import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FaqBotCurrencyService } from './services/faq-bot-currency.service';
import { WalletService } from '../wallet/wallet.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Integration test: verifies the FAQ Bot module connects to the existing
 * multi-currency system (WalletService) without errors, using the REAL
 * WalletService exchange-rate logic rather than a mock.
 */
describe('FaqBotCurrencyService <-> WalletService (integration)', () => {
  let currencyService: FaqBotCurrencyService;
  let walletService: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqBotCurrencyService,
        WalletService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();

    currencyService = module.get<FaqBotCurrencyService>(FaqBotCurrencyService);
    walletService = module.get<WalletService>(WalletService);
  });

  it('should wire both services together', () => {
    expect(currencyService).toBeDefined();
    expect(walletService).toBeDefined();
  });

  it('should convert ETB to USD through the shared platform exchange rates', () => {
    const expected = walletService.convertCurrency(1000, 'ETB', 'USD');
    const viaFaqBot = currencyService.convert(1000, 'ETB', 'USD');

    expect(viaFaqBot).toBe(expected);
  });

  it('should convert USD to ETB consistently across the boundary', () => {
    const expected = walletService.convertCurrency(50, 'USD', 'ETB');
    const viaFaqBot = currencyService.convert(50, 'USD', 'ETB');

    expect(viaFaqBot).toBe(expected);
    expect(viaFaqBot).toBeGreaterThan(0);
  });

  it('should convert USD to EUR across the shared rate table', () => {
    const expected = walletService.convertCurrency(100, 'USD', 'EUR');
    const viaFaqBot = currencyService.convert(100, 'USD', 'EUR');

    expect(viaFaqBot).toBe(expected);
    expect(viaFaqBot).toBeGreaterThan(0);
  });

  it('should format converted amounts without throwing for every supported currency', () => {
    for (const currency of ['ETB', 'USD', 'EUR'] as const) {
      expect(() => currencyService.formatAmount(2500, 'en', currency)).not.toThrow();
      expect(() => currencyService.formatAmount(2500, 'am', currency)).not.toThrow();
    }
  });

  it('should surface a BadRequestException for unsupported currency pairs', () => {
    // 'JPY' is outside the platform's supported ETB/USD/EUR rate table.
    expect(() => currencyService.convert(100, 'USD', 'JPY' as never)).toThrow(
      'Currency conversion from USD to JPY is not supported',
    );
  });

  it('should build an AI currency context using live wallet conversion', () => {
    const context = currencyService.buildCurrencyContext('en', 'USD');

    expect(context).toContain('Supported currencies: ETB, USD, EUR');
    expect(context).toContain('Minimum withdrawal');
  });
});
