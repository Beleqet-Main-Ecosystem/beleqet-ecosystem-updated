import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Internal data transfer object used to create a scheduled interview.
 *
 * Contains the final interview details after the scheduling algorithm
 * selects a suitable time slot.
 */
export class CreateInterviewDto {
  /**
   * Unique identifier of the job application.
   */
  @IsUUID()
  applicationId!: string;

  /**
   * Interview start date and time.
   */
  @IsDateString()
  startTime!: string;

  /**
   * Interview end date and time.
   *
   * Must be later than startTime and match
   * the required interview duration.
   */
  @IsDateString()
  endTime!: string;

  /**
   * Timezone used for displaying the interview time.
   *
   * @example "Africa/Addis_Ababa"
   */
  @IsOptional()
  @IsString()
  timezone?: string;

  /**
   * Optional notes attached to the interview.
   */
  @IsOptional()
  @IsString()
  notes?: string;
}
