import { ApiProperty } from '@nestjs/swagger';
import { KycDocumentType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/**
 * Validates the JSON payload containing secure cloud storage references
 * for processed identity registrations.
 */
export class SubmitKycDto {
  @ApiProperty({
    enum: KycDocumentType,
    description: 'The structural archetype of identification document uploaded',
  })
  @IsEnum(KycDocumentType, {
    message: 'documentType must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE',
  })
  @IsNotEmpty()
  documentType!: KycDocumentType;

  @ApiProperty({
    type: 'string',
    description: 'The secure private S3 object key for the pre-uploaded identity document image',
    example: 'kyc-documents/user-123/ids/id-card.jpg',
  })
  @IsString()
  @IsNotEmpty()
  documentStorageKey!: string;

  @ApiProperty({
    type: 'string',
    description: 'The secure private S3 object key for the pre-uploaded live selfie capture',
    example: 'kyc-documents/user-123/selfies/selfie.jpg',
  })
  @IsString()
  @IsNotEmpty()
  faceScanStorageKey!: string;
}
