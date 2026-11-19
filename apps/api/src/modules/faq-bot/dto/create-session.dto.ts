import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** DTO for creating a new FAQ Bot chat session. */
export class CreateFaqBotSessionDto {
  @ApiPropertyOptional({ description: 'Authenticated user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Anonymous visitor cookie ID' })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  anonymousId?: string;

  @ApiProperty({ enum: ['en', 'am'], default: 'en' })
  @IsIn(['en', 'am'])
  locale: string = 'en';

  @ApiProperty({ enum: ['ETB', 'USD', 'EUR'], default: 'ETB' })
  @IsIn(['ETB', 'USD', 'EUR'])
  preferredCurrency: string = 'ETB';

  @ApiProperty({ description: 'GDPR consent must be true to start chatting' })
  @IsBoolean()
  consentGiven: boolean;
}
