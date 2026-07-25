import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import { CalculateTaxDto, TaxCalculationResult } from './dto/calculate-tax.dto';
import { TaxCalculatorService } from './tax-calculator.service';

@ApiTags('tax-calculator')
@Controller('tax-calculator')
export class TaxCalculatorController {
  constructor(
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly i18n: I18nService,
  ) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate freelancer tax liability',
    description:
      'Estimates progressive tax for ET or US jurisdictions using integer smallest-unit math.',
  })
  @ApiBody({ type: CalculateTaxDto })
  @ApiResponse({ status: 200, description: 'Tax calculation result' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, unsupported jurisdiction, or currency/jurisdiction mismatch',
  })
  async calculate(@Body() dto: CalculateTaxDto): Promise<TaxCalculationResult> {
    try {
      return this.taxCalculatorService.calculate(dto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw await this.mapBadRequest(error, dto);
      }

      if (error instanceof HttpException) {
        throw error;
      }

      const message = await this.resolveI18nMessage(
        'messages.tax.calculationFailed',
        'Tax calculation failed. Please try again.',
      );

      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'ERR_TAX_CALCULATION_FAILED',
        message,
      });
    }
  }

  private async mapBadRequest(
    error: BadRequestException,
    dto: CalculateTaxDto,
  ): Promise<BadRequestException> {
    const response = error.getResponse();
    const payload =
      typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : {};
    const errorCode = typeof payload.errorCode === 'string' ? payload.errorCode : undefined;
    const countryCode =
      (typeof payload.countryCode === 'string'
        ? payload.countryCode
        : (dto.countryCode?.toUpperCase?.() ?? dto.countryCode)) || undefined;

    if (errorCode === 'ERR_TAX_CURRENCY_MISMATCH') {
      const expectedCurrency =
        typeof payload.expectedCurrency === 'string'
          ? payload.expectedCurrency
          : countryCode === 'ET'
            ? 'ETB'
            : countryCode === 'US'
              ? 'USD'
              : undefined;

      const message = await this.resolveI18nMessage(
        'messages.tax.currencyMismatch',
        `Currency "${dto.currency}" does not match jurisdiction "${countryCode}". Expected ${expectedCurrency}.`,
        {
          countryCode,
          currency: dto.currency,
          expectedCurrency,
        },
      );

      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
        message,
        countryCode,
        currency: dto.currency,
        expectedCurrency,
      });
    }

    if (errorCode === 'ERR_TAX_INVALID_GROSS_INCOME') {
      const message = await this.resolveI18nMessage(
        'messages.tax.invalidGrossIncome',
        'grossIncome must be a finite number in smallest currency units.',
      );

      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_TAX_INVALID_GROSS_INCOME',
        message,
      });
    }

    const message = await this.resolveI18nMessage(
      'messages.tax.unsupportedJurisdiction',
      `Unsupported tax jurisdiction "${countryCode}". Supported: ET, US.`,
      { countryCode },
    );

    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
      message,
      countryCode,
    });
  }

  private async resolveI18nMessage(
    key: string,
    defaultValue: string,
    args?: Record<string, unknown>,
  ): Promise<string> {
    const translated = await this.i18n.t(key, { args, defaultValue });

    if (typeof translated === 'string') {
      return translated;
    }

    return defaultValue;
  }
}
