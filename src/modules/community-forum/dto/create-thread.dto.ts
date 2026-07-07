import { IsString, IsOptional, IsArray, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateThreadDto {
  @ApiProperty({ example: 'How to get started with NestJS?', description: 'forum.validation.title' })
  @IsString()
  @MinLength(5, { message: 'forum.validation.titleMinLength' })
  @MaxLength(200, { message: 'forum.validation.titleMaxLength' })
  title: string;

  @ApiProperty({ example: 'I want to learn NestJS...', description: 'forum.validation.content' })
  @IsString()
  @MinLength(20, { message: 'forum.validation.contentMinLength' })
  @MaxLength(10000, { message: 'forum.validation.contentMaxLength' })
  content: string;

  @ApiProperty({ example: ['nestjs', 'typescript'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ example: false, required: false, description: 'forum.validation.isAnonymous' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
