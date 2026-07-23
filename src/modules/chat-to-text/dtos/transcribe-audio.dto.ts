import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranscribeAudioDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsOptional()
  @IsString()
  language?: string;

  /** Marks the last uploaded stream chunk and completes its transcript. */
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
