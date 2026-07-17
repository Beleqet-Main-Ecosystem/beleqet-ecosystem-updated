import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Data transfer object for creating a user availability slot.
 *
 * Represents a time range during which a user is available
 * for interview scheduling.
 */
export class CreateAvailabilityDto {
  /**
   * Start date and time of the availability period.
   *
   * @example "2026-07-28T09:00:00.000Z"
   */
  @IsDateString()
  startTime!: string;
  /**
   * End date and time of the availability period.
   *
   * Must be later than the start time.
   *
   * @example "2026-07-28T11:00:00.000Z"
   */
  @IsDateString()
  endTime!: string;
  /**
   * IANA timezone identifier for the availability slot.
   *
   * @example "Africa/Addis_Ababa"
   */
  @IsOptional()
  @IsString()
  timezone?: string;
}
