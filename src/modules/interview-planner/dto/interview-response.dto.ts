import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClearableUrl } from '../../../common/decorators/clearable-url.decorator';

export class RespondInterviewDto {
  @IsIn(['CONFIRMED', 'DECLINED']) response: 'CONFIRMED' | 'DECLINED';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class InterviewDetailsDto {
  @IsOptional() @IsString() @MaxLength(200) location?: string | null;
  @ClearableUrl() meetingLink?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
