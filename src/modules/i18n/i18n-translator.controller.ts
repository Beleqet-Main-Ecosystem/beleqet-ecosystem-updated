import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { LocaleFormatterService } from './locale-formatter.service';
import { FormatRequestDto } from './dto/format-request.dto';

/**
 * Exposes i18n utilities:
 *  - GET  /i18n/supported  → list of supported locales
 *  - GET  /i18n/translate  → translate a single key in the requested lang
 *  - POST /i18n/format     → format number, currency, and date per locale
 */
@ApiTags('i18n')
@Controller('i18n')
export class I18nTranslatorController {
  constructor(private readonly formatter: LocaleFormatterService) {}

  /** Returns the list of locales supported by the platform. */
  @Get('supported')
  @ApiOperation({ summary: 'List supported locale codes' })
  getSupportedLanguages(): { languages: string[] } {
    return { languages: ['en', 'am', 'ar', 'fr'] };
  }

  /**
   * Translates a dot-notation key (e.g. "common.welcome") using the
   * locale resolved from the Accept-Language header, x-custom-lang header,
   * or ?lang= query param — handled automatically by nestjs-i18n.
   */
  @Get('translate')
  @ApiOperation({ summary: 'Translate a message key' })
  @ApiQuery({ name: 'key', example: 'common.welcome' })
  @ApiQuery({ name: 'lang', required: false, example: 'am' })
  async translate(
    @Query('key') key: string,
    @I18n() i18n: I18nContext,
  ): Promise<{ key: string; value: string }> {
    const value = await i18n.translate(`messages.${key}`);
    return { key, value };
  }

  /**
   * Formats a number, currency amount, and/or date according to the
   * requested locale. All fields are optional — only provided fields
   * are included in the response.
   */
  @Post('format')
  @ApiOperation({ summary: 'Format number, currency, and date by locale' })
  formatLocale(@Body() dto: FormatRequestDto): Record<string, string> {
    const result: Record<string, string> = {};

    if (dto.amount !== undefined) {
      result.number = this.formatter.formatNumber(dto.amount, dto.lang);
      result.currency = this.formatter.formatCurrency(dto.amount, dto.lang, dto.currency);
    }

    if (dto.date) {
      result.date = this.formatter.formatDate(dto.date, dto.lang);
    }

    return result;
  }
}
