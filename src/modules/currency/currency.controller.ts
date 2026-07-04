import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrencyService } from './currency.service';
import { Permission } from '../../common/constants/roles';

/**
 * Currency Controller - Handles multi-currency operations
 * @class CurrencyController
 */
@Controller('currency')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('currency')
@ApiBearerAuth()
export class CurrencyController {
  constructor(private currencyService: CurrencyService) {}

  /**
   * Get all supported currencies
   * @returns {Promise<Array>} - List of currencies
   */
  @Get('currencies')
  @RequirePermissions(Permission.VIEW_CURRENCIES)
  @ApiOperation({ summary: 'Get all supported currencies' })
  async getCurrencies() {
    return this.currencyService.getCurrencies();
  }

  /**
   * Get a specific currency by code
   * @param code - Currency code
   * @returns {Promise<object>} - Currency details
   */
  @Get('currencies/:code')
  @RequirePermissions(Permission.VIEW_CURRENCIES)
  @ApiOperation({ summary: 'Get currency by code' })
  async getCurrency(@Param('code') code: string) {
    return this.currencyService.getCurrencyByCode(code);
  }

  /**
   * Convert currency amount
   * @param amount - Amount to convert
   * @param from - Source currency
   * @param to - Target currency
   * @returns {Promise<object>} - Conversion result
   */
  @Get('convert')
  @RequirePermissions(Permission.CONVERT_CURRENCY)
  @ApiOperation({ summary: 'Convert currency amount' })
  async convertCurrency(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.currencyService.convertCurrency(
      parseFloat(amount),
      from,
      to,
    );
  }

  /**
   * Get user's default currency
   * @param user - Current authenticated user
   * @returns {Promise<object>} - User's default currency
   */
  @Get('my-currency')
  @ApiOperation({ summary: 'Get user default currency' })
  async getUserCurrency(@CurrentUser() user: CurrentUserPayload) {
    return this.currencyService.getUserCurrency(user.userId);
  }

  /**
   * Set user's default currency
   * @param user - Current authenticated user
   * @param body - Contains currency code
   * @returns {Promise<object>} - Updated user currency
   */
  @Post('my-currency')
  @ApiOperation({ summary: 'Set user default currency' })
  async setUserCurrency(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { currencyCode: string },
  ) {
    return this.currencyService.setUserCurrency(
      user.userId,
      body.currencyCode,
    );
  }

  /**
   * Format currency amount
   * @param amount - Amount to format
   * @param currency - Currency code
   * @param locale - Locale (optional)
   * @returns {Promise<string>} - Formatted currency
   */
  @Get('format')
  @ApiOperation({ summary: 'Format currency amount' })
  async formatCurrency(
    @Query('amount') amount: string,
    @Query('currency') currency: string,
    @Query('locale') locale?: string,
  ) {
    return this.currencyService.formatCurrency(
      parseFloat(amount),
      currency,
      locale || 'en',
    );
  }
}