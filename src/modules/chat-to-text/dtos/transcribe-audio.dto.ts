import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranscribeAudioDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsOptional()
  @IsString()
  language?: string;
}
