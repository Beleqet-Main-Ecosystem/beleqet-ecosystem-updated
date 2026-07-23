
import { IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

}
