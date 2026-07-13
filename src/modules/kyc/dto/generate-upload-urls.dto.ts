import { ApiProperty } from '@nestjs/swagger';
import { IsMimeType } from 'class-validator';

/**
 * Request payload for generating temporary KYC upload URLs.
 *
 * The client provides the MIME types of the files it intends
 * to upload. The backend validates these values before creating
 * secure cloud storage upload URLs.
 */
export class GenerateUploadUrlsDto {
  /**
   * MIME type of the identity document.
   *
   * Example:
   * image/jpeg
   * image/png
   */
  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type of the identity document.',
  })
  @IsMimeType()
  documentContentType!: string;

  /**
   * MIME type of the face scan/selfie image.
   *
   * Example:
   * image/jpeg
   * image/png
   */
  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type of the face scan image.',
  })
  @IsMimeType()
  faceScanContentType!: string;
}
