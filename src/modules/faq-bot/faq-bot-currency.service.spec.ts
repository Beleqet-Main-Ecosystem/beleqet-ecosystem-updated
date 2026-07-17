import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FaqBotCurrencyService } from './services/faq-bot-currency.service';
import { WalletService } from '../wallet/wallet.service';

describe('FaqBotCurrencyService', () => {
  let service: FaqBotCurrencyService;

  const mockWalletService = {
    convertCurrency: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqBotCurrencyService,
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    service = module.get<FaqBotCurrencyService>(FaqBotCurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convert', () => {
    it('should return the same amount when currencies match without calling the wallet', () => {
      expect(service.convert(100, 'ETB', 'ETB')).toBe(100);
      expect(mockWalletService.convertCurrency).not.toHaveBeenCalled();
    });

    it('should delegate conversion to the platform WalletService', () => {
      mockWalletService.convertCurrency.mockReturnValue(12050);

      const result = service.convert(100, 'USD', 'ETB');

      expect(result).toBe(12050);
      expect(mockWalletService.convertCurrency).toHaveBeenCalledWith(100, 'USD', 'ETB');
    });

    it('should raise a BadRequestException when the wallet cannot convert the pair', () => {
      mockWalletService.convertCurrency.mockImplementation(() => {
        throw new Error('Exchange rate for USD to JPY not found');
      });

      expect(() => service.convert(100, 'USD', 'EUR')).toThrow(BadRequestException);
    });
  });

  describe('formatAmount', () => {
    it('should format ETB without conversion', () => {
      const formatted = service.formatAmount(1500, 'en', 'ETB');

      expect(mockWalletService.convertCurrency).not.toHaveBeenCalled();
      expect(formatted).toContain('1,500');
    });

    it('should convert to the target currency before formatting', () => {
      mockWalletService.convertCurrency.mockReturnValue(2);

      const formatted = service.formatAmount(240, 'en', 'USD');

      expect(mockWalletService.convertCurrency).toHaveBeenCalledWith(240, 'ETB', 'USD');
      expect(formatted).toContain('2');
    });
  });

  describe('buildCurrencyContext', () => {
    it('should include the supported currencies and escrow fee reference', () => {
      const context = service.buildCurrencyContext('en', 'ETB');

      expect(context).toContain('Supported currencies: ETB, USD, EUR');
      expect(context).toContain('Platform escrow fee: 5%');
      expect(context).toContain('Minimum withdrawal');
    });
  });
});
