import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

/** DTO for submitting a user question to the FAQ Bot. */
export class AskFaqBotQuestionDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty({ example: 'How do I withdraw from my wallet?' })
  @IsString()
  @Length(2, 2000)
  message: string;
}
