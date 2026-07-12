/**
 * Search Exceptions
 *
 * Custom exceptions for search-related errors.
 * Following NestJS exception handling patterns.
 */

import {
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Exception thrown when search filters are invalid
 */
export class InvalidSearchFiltersException extends BadRequestException {
  constructor(message: string) {
    super({
      statusCode: 400,
      message: message,
    });
  }
}

/**
 * Exception thrown when search service is unavailable
 */
export class SearchServiceUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      statusCode: 503,
      message: 'Search service temporarily unavailable',
      error: 'SEARCH_SERVICE_UNAVAILABLE',
    });
  }
}

/**
 * Exception thrown when search results are not found
 */
export class SearchResultsNotFoundException extends NotFoundException {
  constructor(criteria?: string) {
    super({
      statusCode: 404,
      message: 'No search results found',
      error: criteria ? `No results found for: ${criteria}` : 'SEARCH_RESULTS_NOT_FOUND',
    });
  }
}

/**
 * Exception thrown when currency conversion fails
 */
export class CurrencyConversionException extends BadRequestException {
  constructor(message: string) {
    super({
      statusCode: 400,
      message: 'Currency conversion failed',
      error: message,
    });
  }
}

/**
 * Exception thrown when rating calculation fails
 */
export class RatingCalculationException extends BadRequestException {
  constructor(message: string) {
    super({
      statusCode: 400,
      message: 'Rating calculation failed',
      error: message,
    });
  }
}
