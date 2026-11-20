import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

/**
 * Provides utility methods for validating
 * interview and availability date ranges.
 */
@Injectable()
export class DateHelper {
  constructor(private readonly i18n: I18nService) {}

  /**
   * Validates that the end time is later than the start time.
   *
   * @param startTime Start of the time range
   * @param endTime End of the time range
   * @throws BadRequestException If the end time is not after the start time
   */
  async validateRange(startTime: Date, endTime: Date): Promise<void> {
    if (endTime <= startTime) {
      throw new BadRequestException(
        await this.i18n.translate('interview.availability.invalidRange'),
      );
    }
  }
}
