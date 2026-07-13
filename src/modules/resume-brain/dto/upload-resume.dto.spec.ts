import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadResumeDto } from './upload-resume.dto';

describe('UploadResumeDto', () => {
  it('should validate successfully when consent is true', async () => {
    const dto = plainToInstance(UploadResumeDto, { consent: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept the multipart form string "true" and coerce it to boolean', async () => {
    const dto = plainToInstance(UploadResumeDto, { consent: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.consent).toBe(true);
  });

  it('should reject when consent is false', async () => {
    const dto = plainToInstance(UploadResumeDto, { consent: false });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject when consent is missing', async () => {
    const dto = plainToInstance(UploadResumeDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
