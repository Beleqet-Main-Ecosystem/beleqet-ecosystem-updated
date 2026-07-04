import { Module } from '@nestjs/common';
import { I18nTranslatorController } from './i18n-translator.controller';
import { LocaleFormatterService } from './locale-formatter.service';

/**
 * GlobalTranslatorModule — provides locale-aware translation and formatting
 * across the Beleqet platform (i18n, date/number/currency localization).
 */
@Module({
  controllers: [I18nTranslatorController],
  providers: [LocaleFormatterService],
  exports: [LocaleFormatterService],
})
export class GlobalTranslatorModule {}
