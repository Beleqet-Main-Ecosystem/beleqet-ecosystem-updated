import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * NoValidationPipe
 * 
 * A pipe that bypasses validation to allow all query parameters to pass through.
 * This is used for the Advanced Search module to enable service-layer validation
 * with i18n support, as class-validator decorators were removed from the DTO.
 */
@Injectable()
export class NoValidationPipe implements PipeTransform {
  transform(value: any) {
    return value;
  }
}
