/**
 * Create Transcript DTO
 * Data Transfer Object for creating new transcripts
 */

import { IsString, IsOptional, IsNumber, Min, IsEnum, IsNotEmpty } from 'class-validator';

export enum TranscriptProvider {
  OPENAI = 'openai',
  GOOGLE_CLOUD = 'google-cloud',
  WEB_SPEECH_API = 'web-speech-api',
  AZURE = 'azure',
  FASTER_WHISPER = 'faster-whisper',
}

export class CreateTranscriptDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

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

  @IsString()
  @IsNotEmpty()
  rawText!: string;
}
