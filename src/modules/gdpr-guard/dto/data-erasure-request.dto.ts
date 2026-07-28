import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for validating GDPR Data Erasure (Right to be Forgotten) requests.
 */
export class DataErasureRequestDto {
  /**
   * The unique identifier of the user requesting data deletion.
   */
  @IsUUID('4', { message: 'A valid UUID v4 must be provided for the user ID.' })
  @IsNotEmpty({ message: 'User ID is required for GDPR operations.' })
  userId: string;

  /**
   * Regulatory compliance audit reason for data erasure.
   */
  @IsString()
  @IsNotEmpty({
    message: 'Reason for data erasure request must be documented for compliance logs.',
  })
  reason: string;
}
