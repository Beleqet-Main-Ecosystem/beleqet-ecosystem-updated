import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean } from 'class-validator';

/**
 * Multipart form fields accompanying a CV file upload. The file itself is
 * bound separately via `@UploadedFile()`.
 */
export class UploadResumeDto {
  @ApiProperty({
    example: true,
    description: 'Explicit GDPR consent to process this CV’s personal data. Must be true.',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'consent must be a boolean value' })
  @Equals(true, { message: 'You must consent to processing of your CV data before uploading' })
  consent: boolean;
}
