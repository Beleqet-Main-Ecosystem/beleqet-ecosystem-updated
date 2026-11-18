import { IsUUID } from 'class-validator';

/**
 * Data transfer object for automatically scheduling an interview.
 *
 * The system uses the provided application identifier to:
 * - Validate the job application.
 * - Find the common available time between employer and candidate.
 * - Automatically create the interview at the earliest suitable slot.
 */
export class AutoScheduleInterviewDto {
  /**
   * Unique identifier of the job application.
   *
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID()
  applicationId!: string;
}
