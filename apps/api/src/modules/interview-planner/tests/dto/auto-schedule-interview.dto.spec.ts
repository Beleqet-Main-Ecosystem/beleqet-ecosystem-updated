import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { AutoScheduleInterviewDto } from '../../dto/auto-schedule-interview.dto';

describe('AutoScheduleInterviewDto', () => {
  it('should accept valid UUID', async () => {
    const dto = plainToInstance(AutoScheduleInterviewDto, {
      applicationId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('should reject invalid UUID', async () => {
    const dto = plainToInstance(AutoScheduleInterviewDto, {
      applicationId: '123',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
