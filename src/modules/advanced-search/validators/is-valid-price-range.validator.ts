import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

interface PriceRangeFields {
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Ensures minPrice is less than or equal to maxPrice when both are provided.
 */
export function IsValidPriceRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPriceRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as PriceRangeFields;
          if (dto.minPrice === undefined || dto.maxPrice === undefined) {
            return true;
          }
          return dto.minPrice <= dto.maxPrice;
        },
        defaultMessage() {
          return 'Minimum price must be less than or equal to maximum price';
        },
      },
    });
  };
}
