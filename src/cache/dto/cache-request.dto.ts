import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class CacheRequestDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  ttl?: number;

  @IsOptional()
  @IsIn(['product', 'user', 'price', 'marketplace'], {
    message: 'namespace must be one of: product, user, price, marketplace',
  })
  namespace?: string;
}
