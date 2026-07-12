import { ValidationPipe, ValidationPipeOptions, Injectable, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class I18nValidationPipe extends ValidationPipe {
  constructor(private readonly i18n: I18nService, options?: ValidationPipeOptions) {
    super({
      ...options,
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const translatedMessages = errors.map((error) => {
          const constraints = error.constraints || {};
          const messages = Object.values(constraints);
          
          // Translate each constraint message
          return messages.map((msg) => this.translateMessage(msg, error.property)).join(', ');
        });

        return new BadRequestException(translatedMessages);
      },
    });
  }

  private translateMessage(message: string, property: string): string {
    // Handle common class-validator error messages
    const translations: Record<string, string> = {
      // Rating validation
      'minRating must not be greater than 5': this.i18n.t('search.invalid_rating'),
      'must not be greater than 5': this.i18n.t('search.invalid_rating'),
      
      // Currency validation
      'currency must be one of the following values': this.i18n.t('search.invalid_currency'),
      'must be one of the following values': this.i18n.t('search.invalid_currency'),
      
      // Page validation
      'page must be greater than or equal to 1': this.i18n.t('search.invalid_page'),
      'must be greater than or equal to 1': this.i18n.t('search.invalid_page'),
      
      // Limit validation
      'limit must not be greater than 100': this.i18n.t('search.invalid_limit'),
      'must not be greater than 100': this.i18n.t('search.invalid_limit'),
      
      // Price range validation (custom validator)
      'Minimum price must be less than or equal to maximum price': this.i18n.t('search.invalid_price_range'),
      
      // Number validation
      'must be a number': this.i18n.t('search.invalid_number'),
      
      // String validation
      'must be a string': this.i18n.t('search.invalid_string'),
      
      // Array validation
      'must be an array': this.i18n.t('search.invalid_array'),
      
      // Property should not exist
      'property should not exist': this.i18n.t('search.invalid_property'),
    };

    // Check for exact matches first
    if (translations[message]) {
      return translations[message];
    }

    // Check for partial matches
    for (const [key, translation] of Object.entries(translations)) {
      if (message.includes(key) || key.includes(message)) {
        return translation;
      }
    }

    // Return original message if no translation found
    return message;
  }
}

