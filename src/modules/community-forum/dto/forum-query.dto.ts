import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ForumSortOrder {
  LATEST = 'latest',
  POPULAR = 'popular',
  UNANSWERED = 'unanswered',
}

export class ForumQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false, enum: ForumSortOrder, default: ForumSortOrder.LATEST })
  @IsOptional()
  @IsEnum(ForumSortOrder)
  sort?: ForumSortOrder = ForumSortOrder.LATEST;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tag?: string;
}
