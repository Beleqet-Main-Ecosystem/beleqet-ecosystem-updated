import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { CreateInterviewDto } from '../../dto/create-interview.dto';

describe('CreateInterviewDto', () => {
  it('should validate complete schedule request', async () => {
    const dto = plainToInstance(CreateInterviewDto, {
      applicationId: '550e8400-e29b-41d4-a716-446655440000',

      startTime: '2026-07-30T10:00:00Z',

      endTime: '2026-07-30T11:00:00Z',

      timezone: 'UTC',

      notes: 'Technical interview',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('should reject missing application id', async () => {
    const dto = plainToInstance(CreateInterviewDto, {
      startTime: '2026-07-30T10:00:00Z',

      endTime: '2026-07-30T11:00:00Z',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
