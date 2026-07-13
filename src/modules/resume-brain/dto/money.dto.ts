import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * A monetary amount paired with its ISO 4217 currency code.
 * `amount` is always a decimal string (never a float/number) to avoid
 * floating-point rounding errors when persisting or displaying money.
 */
export class MoneyDto {
  @ApiProperty({ example: '45000.00', description: 'Decimal string amount, never a float' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a decimal string such as "45000.00"',
  })
  amount: string;

  @ApiProperty({ example: 'ETB', description: 'ISO 4217 currency code' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currencyCode must be a 3-letter ISO 4217 code, e.g. "ETB"' })
  currencyCode: string;
}
