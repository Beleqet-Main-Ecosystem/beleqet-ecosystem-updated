import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { CreateAvailabilityDto } from '../../dto/create-availability.dto';

describe('CreateAvailabilityDto', () => {
  it('should validate correct availability data', async () => {
    const dto = plainToInstance(CreateAvailabilityDto, {
      startTime: '2026-07-30T10:00:00Z',

      endTime: '2026-07-30T11:00:00Z',

      timezone: 'UTC',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('should reject invalid date format', async () => {
    const dto = plainToInstance(CreateAvailabilityDto, {
      startTime: 'invalid-date',

      endTime: 'invalid-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
