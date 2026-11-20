import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { TranscriptProvider } from './create-transcript.dto';

export class UpdateTranscriptDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(TranscriptProvider)
  provider?: TranscriptProvider;

  @IsOptional()
  @IsString()
  rawText?: string;
}
