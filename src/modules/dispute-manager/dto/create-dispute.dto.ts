import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * Data Transfer Object for creating a new dispute.
 */
export class CreateDisputeDto {
  /**
   * The UUID of the contract being disputed
   */
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  /**
   * The reason for the dispute (e.g. quality of work, deadline delays)
   */
  @IsNotEmpty()
  @IsString()
  reason: string;

  /**
   * URLs of evidence provided by the user
   */
  @IsArray()
  @IsString({ each: true })
  evidenceUrls: string[];
}
