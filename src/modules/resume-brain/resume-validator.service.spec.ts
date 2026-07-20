import { BadRequestException } from '@nestjs/common';
import { ResumeValidatorService } from './resume-validator.service';
import {
  EMPTY_EXTRACTED_RESUME,
  ExtractedResume,
} from './dto/extracted-resume.dto';

const validResume = (over: Partial<ExtractedResume> = {}): ExtractedResume => ({
  ...EMPTY_EXTRACTED_RESUME,
  firstName: 'Abebe',
  lastName: 'Bikila',
  email: 'abebe@example.com',
  skills: ['Node.js'],
  ...over,
});

describe('ResumeValidatorService', () => {
  let service: ResumeValidatorService;

  beforeEach(() => {
    service = new ResumeValidatorService();
  });

  it('returns the resume unchanged when it is valid', () => {
    const input = validResume();
    expect(service.validate(input)).toMatchObject({
      firstName: 'Abebe',
      email: 'abebe@example.com',
      skills: ['Node.js'],
    });
  });

  it('accepts a resume with an empty email (email is optional)', () => {
    expect(() => service.validate(validResume({ email: '' }))).not.toThrow();
  });

  it('rejects an empty / non-resume result with 400 (the "hello world" case)', () => {
    expect(() => service.validate({ ...EMPTY_EXTRACTED_RESUME })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a malformed email with 400', () => {
    expect(() =>
      service.validate(validResume({ email: 'not-an-email' })),
    ).toThrow(BadRequestException);
  });

  it('includes field-level messages in the 400 body', () => {
    try {
      service.validate(validResume({ email: 'bad' }));
      fail('expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(res.errors.some((m) => m.startsWith('email:'))).toBe(true);
    }
  });

  it('rejects an over-long field with 400', () => {
    expect(() =>
      service.validate(validResume({ summary: 'x'.repeat(5001) })),
    ).toThrow(BadRequestException);
  });

  it('validates nested experience entries', () => {
    const bad = validResume({
      experience: [
        {
          role: 'x'.repeat(201), // exceeds MaxLength(200)
          company: 'ACME',
          start: '2020',
          end: '2021',
          description: 'did things',
        },
      ],
    });
    expect(() => service.validate(bad)).toThrow(BadRequestException);
  });

  it('accepts a resume that only has experience (no name/email)', () => {
    const input = validResume({
      firstName: '',
      lastName: '',
      email: '',
      skills: [],
      experience: [
        {
          role: 'Engineer',
          company: 'Beleqet',
          start: '2021',
          end: 'Present',
          description: 'Built things.',
        },
      ],
    });
    expect(() => service.validate(input)).not.toThrow();
  });
});
