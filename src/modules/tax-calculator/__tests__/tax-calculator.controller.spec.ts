import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { CalculateTaxDto, TaxCurrency, TaxCalculationResult } from '../dto/calculate-tax.dto';
import { TaxCalculatorController } from '../tax-calculator.controller';
import { TaxCalculatorService } from '../tax-calculator.service';

describe('TaxCalculatorController', () => {
  let controller: TaxCalculatorController;
  let taxCalculatorService: jest.Mocked<Pick<TaxCalculatorService, 'calculate'>>;
  let i18nService: { t: jest.Mock };

  const etDto: CalculateTaxDto = {
    grossIncome: 12_000_000,
    currency: TaxCurrency.ETB,
    countryCode: 'ET',
  };

  const usDto: CalculateTaxDto = {
    grossIncome: 5_000_000,
    currency: TaxCurrency.USD,
    countryCode: 'US',
  };

  const etResult: TaxCalculationResult = {
    grossIncome: 12_000_000,
    taxAmount: 2_454_000,
    netIncome: 9_546_000,
    currency: TaxCurrency.ETB,
    countryCode: 'ET',
    effectiveTaxRate: 0.2045,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    taxCalculatorService = {
      calculate: jest.fn(),
    };

    i18nService = {
      t: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxCalculatorController],
      providers: [
        {
          provide: TaxCalculatorService,
          useValue: taxCalculatorService,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    controller = module.get<TaxCalculatorController>(TaxCalculatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('successful calculation pass-through', () => {
    it('returns the service result for a valid ET request', async () => {
      taxCalculatorService.calculate.mockReturnValue(etResult);

      const result = await controller.calculate(etDto);

      expect(taxCalculatorService.calculate).toHaveBeenCalledTimes(1);
      expect(taxCalculatorService.calculate).toHaveBeenCalledWith(etDto);
      expect(result).toEqual(etResult);
      expect(i18nService.t).not.toHaveBeenCalled();
    });

    it('returns the service result for a valid US request', async () => {
      const usResult: TaxCalculationResult = {
        grossIncome: 5_000_000,
        taxAmount: 400_950,
        netIncome: 4_599_050,
        currency: TaxCurrency.USD,
        countryCode: 'US',
        effectiveTaxRate: 0.08019,
      };
      taxCalculatorService.calculate.mockReturnValue(usResult);

      const result = await controller.calculate(usDto);

      expect(taxCalculatorService.calculate).toHaveBeenCalledWith(usDto);
      expect(result).toEqual(usResult);
    });
  });

  describe('unsupported jurisdiction mapping', () => {
    it('awaits i18n and rethrows BadRequestException with ERR_TAX_UNSUPPORTED_JURISDICTION', async () => {
      const serviceError = new BadRequestException({
        statusCode: 400,
        errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
        message: 'Unsupported tax jurisdiction "XX". Supported: ET, US.',
        countryCode: 'XX',
      });
      taxCalculatorService.calculate.mockImplementation(() => {
        throw serviceError;
      });
      i18nService.t.mockResolvedValue('Translated: unsupported jurisdiction "XX"');

      const dto: CalculateTaxDto = {
        grossIncome: 1_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'XX',
      };

      await expect(controller.calculate(dto)).rejects.toBeInstanceOf(BadRequestException);

      try {
        await controller.calculate(dto);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_UNSUPPORTED_JURISDICTION');
        expect(body.message).toBe('Translated: unsupported jurisdiction "XX"');
        expect(body.countryCode).toBe('XX');
      }

      expect(i18nService.t).toHaveBeenCalledWith(
        'messages.tax.unsupportedJurisdiction',
        expect.objectContaining({
          args: { countryCode: 'XX' },
          defaultValue: expect.stringContaining('Unsupported tax jurisdiction'),
        }),
      );
    });

    it('falls back to defaultValue when i18n.t resolves a non-string', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
          message: 'raw',
          countryCode: 'ZZ',
        });
      });
      i18nService.t.mockResolvedValue({ nested: true });

      try {
        await controller.calculate({
          grossIncome: 100,
          currency: TaxCurrency.ETB,
          countryCode: 'ZZ',
        });
        fail('expected BadRequestException');
      } catch (error) {
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_UNSUPPORTED_JURISDICTION');
        expect(body.message).toBe('Unsupported tax jurisdiction "ZZ". Supported: ET, US.');
      }
    });
  });

  describe('currency mismatch mapping', () => {
    it('awaits i18n and rethrows BadRequestException with ERR_TAX_CURRENCY_MISMATCH', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
          message: 'Currency "USD" does not match jurisdiction "ET". Expected ETB.',
          countryCode: 'ET',
          currency: TaxCurrency.USD,
          expectedCurrency: 'ETB',
        });
      });
      i18nService.t.mockResolvedValue('Translated: currency USD does not match ET (expected ETB)');

      const dto: CalculateTaxDto = {
        grossIncome: 1_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'ET',
      };

      try {
        await controller.calculate(dto);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_CURRENCY_MISMATCH');
        expect(body.message).toBe('Translated: currency USD does not match ET (expected ETB)');
        expect(body.countryCode).toBe('ET');
        expect(body.currency).toBe(TaxCurrency.USD);
        expect(body.expectedCurrency).toBe('ETB');
      }

      expect(i18nService.t).toHaveBeenCalledWith(
        'messages.tax.currencyMismatch',
        expect.objectContaining({
          args: {
            countryCode: 'ET',
            currency: TaxCurrency.USD,
            expectedCurrency: 'ETB',
          },
        }),
      );
    });

    it('infers expectedCurrency when service payload omits it', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
          countryCode: 'US',
        });
      });
      i18nService.t.mockResolvedValue('US requires USD');

      try {
        await controller.calculate({
          grossIncome: 1_000_000,
          currency: TaxCurrency.ETB,
          countryCode: 'US',
        });
        fail('expected BadRequestException');
      } catch (error) {
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_CURRENCY_MISMATCH');
        expect(body.expectedCurrency).toBe('USD');
        expect(body.message).toBe('US requires USD');
      }
    });
  });

  describe('invalid gross income mapping', () => {
    it('maps ERR_TAX_INVALID_GROSS_INCOME via i18n', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_INVALID_GROSS_INCOME',
          message: 'raw invalid',
        });
      });
      i18nService.t.mockResolvedValue('Translated: invalid gross income');

      try {
        await controller.calculate({
          ...etDto,
          grossIncome: Number.NaN,
        });
        fail('expected BadRequestException');
      } catch (error) {
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_INVALID_GROSS_INCOME');
        expect(body.message).toBe('Translated: invalid gross income');
      }

      expect(i18nService.t).toHaveBeenCalledWith(
        'messages.tax.invalidGrossIncome',
        expect.objectContaining({
          defaultValue: expect.stringContaining('finite number'),
        }),
      );
    });
  });

  describe('unexpected and generic HTTP errors', () => {
    it('maps unknown errors to InternalServerErrorException via i18n', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new Error('boom');
      });
      i18nService.t.mockResolvedValue('Translated: calculation failed');

      try {
        await controller.calculate(etDto);
        fail('expected InternalServerErrorException');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        const body = (error as InternalServerErrorException).getResponse() as Record<
          string,
          unknown
        >;
        expect(body.errorCode).toBe('ERR_TAX_CALCULATION_FAILED');
        expect(body.message).toBe('Translated: calculation failed');
        expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }

      expect(i18nService.t).toHaveBeenCalledWith(
        'messages.tax.calculationFailed',
        expect.objectContaining({
          defaultValue: 'Tax calculation failed. Please try again.',
        }),
      );
    });

    it('re-throws non-BadRequest HttpException without i18n remapping', async () => {
      const conflict = new HttpException('Conflict from upstream', HttpStatus.CONFLICT);
      taxCalculatorService.calculate.mockImplementation(() => {
        throw conflict;
      });

      await expect(controller.calculate(etDto)).rejects.toBe(conflict);
      expect(i18nService.t).not.toHaveBeenCalled();
    });

    it('maps BadRequestException without errorCode as unsupported jurisdiction', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException('plain bad request');
      });
      i18nService.t.mockResolvedValue('Translated fallback unsupported');

      try {
        await controller.calculate(etDto);
        fail('expected BadRequestException');
      } catch (error) {
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_UNSUPPORTED_JURISDICTION');
        expect(body.message).toBe('Translated fallback unsupported');
        expect(body.countryCode).toBe('ET');
      }
    });
  });

  describe('i18n async resolution', () => {
    it('does not stringify an unresolved Promise as the message', async () => {
      taxCalculatorService.calculate.mockImplementation(() => {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
          countryCode: 'XX',
        });
      });

      let resolveTranslation!: (value: string) => void;
      i18nService.t.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        }),
      );

      const pending = controller.calculate({
        grossIncome: 1,
        currency: TaxCurrency.USD,
        countryCode: 'XX',
      });

      resolveTranslation('Amharic unsupported XX');

      try {
        await pending;
        fail('expected BadRequestException');
      } catch (error) {
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.message).toBe('Amharic unsupported XX');
        expect(body.message).not.toBe('[object Promise]');
      }
    });
  });
});
