import { IsString, IsOptional, IsUUID, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReplyDto {
  @ApiProperty({ example: 'Great question! Here is my advice...', description: 'forum.validation.content' })
  @IsString()
  @MinLength(1, { message: 'forum.validation.replyMinLength' })
  @MaxLength(5000, { message: 'forum.validation.replyMaxLength' })
  content: string;

  @ApiProperty({ example: 'uuid-of-parent-reply', required: false, description: 'forum.validation.parentReplyId' })
  @IsOptional()
  @IsUUID()
  parentReplyId?: string;

  @ApiProperty({ example: false, required: false, description: 'forum.validation.isAnonymous' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
