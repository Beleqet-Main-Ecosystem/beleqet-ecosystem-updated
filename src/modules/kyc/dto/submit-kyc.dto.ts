import { ApiProperty } from '@nestjs/swagger';
import { KycDocumentType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, IsMimeType } from 'class-validator';

/**
 * Validates the JSON payload containing secure cloud storage references
 * and metadata required for KYC verification processing.
 *
 * The frontend uploads files directly to private cloud storage first,
 * then submits the generated storage keys together with the original
 * MIME types so downstream verification providers can process files
 * correctly.
 */
export class SubmitKycDto {
  @ApiProperty({
    enum: KycDocumentType,
    description: 'The type of identity document submitted.',
    example: KycDocumentType.PASSPORT,
  })
  @IsEnum(KycDocumentType)
  @IsNotEmpty()
  documentType!: KycDocumentType;

  @ApiProperty({
    type: 'string',
    description: 'Private cloud storage key referencing the uploaded identity document.',
    example: 'kyc-documents/ids/8f1c-document.png',
  })
  @IsString()
  @IsNotEmpty()
  documentStorageKey!: string;

  @ApiProperty({
    type: 'string',
    description: 'Private cloud storage key referencing the uploaded face scan image.',
    example: 'kyc-documents/selfies/8f1c-selfie.jpg',
  })
  @IsString()
  @IsNotEmpty()
  faceScanStorageKey!: string;

  @ApiProperty({
    type: 'string',
    description: 'MIME type of the uploaded identity document.',
    example: 'image/png',
  })
  @IsMimeType()
  @IsNotEmpty()
  documentMimeType!: string;

  @ApiProperty({
    type: 'string',
    description: 'MIME type of the uploaded face scan image.',
    example: 'image/jpeg',
  })
  @IsMimeType()
  @IsNotEmpty()
  faceScanMimeType!: string;
}
