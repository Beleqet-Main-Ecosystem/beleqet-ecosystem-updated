import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AutofillProfileDto } from './autofill-profile.dto';

describe('AutofillProfileDto', () => {
  it('should validate successfully with a valid UUID', async () => {
    const dto = plainToInstance(AutofillProfileDto, {
      resumeId: 'b3f1c2b0-8f1a-4b8b-9c1a-7e2a6f1e2d33',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject a non-UUID resumeId', async () => {
    const dto = plainToInstance(AutofillProfileDto, { resumeId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a missing resumeId', async () => {
    const dto = plainToInstance(AutofillProfileDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
