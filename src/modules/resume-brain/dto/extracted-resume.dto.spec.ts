import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExtractedResumeDto } from './extracted-resume.dto';

describe('ExtractedResumeDto', () => {
  it('should validate successfully when every field is fully populated', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: {
        fullName: 'Selam Tesfaye',
        email: 'selam@example.com',
        phone: '+251911223344',
        location: 'Addis Ababa, Ethiopia',
      },
      education: [
        {
          institution: 'Addis Ababa University',
          degree: 'BSc',
          fieldOfStudy: 'Computer Science',
          startDate: '2018-09-01',
          endDate: '2022-06-30',
        },
      ],
      workExperience: [
        {
          company: 'Beleqet',
          title: 'Software Engineer',
          startDate: '2022-07-01',
          endDate: null,
          description: 'Built the Resume Brain module.',
          compensation: { amount: '45000.00', currencyCode: 'ETB' },
        },
      ],
      skills: ['TypeScript', 'NestJS'],
      certifications: ['AWS Certified Cloud Practitioner'],
      languages: [{ language: 'Amharic', proficiency: 'Native' }],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate successfully when every optional field is null/empty (never crash on missing data)', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: { fullName: null, email: null, phone: null, location: null },
      education: [],
      workExperience: [],
      skills: [],
      certifications: [],
      languages: [],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email address', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: { fullName: null, email: 'not-an-email', phone: null, location: null },
      education: [],
      workExperience: [],
      skills: [],
      certifications: [],
      languages: [],
    });

    const errors = await validate(dto);
    const personalInfoError = errors.find((e) => e.property === 'personalInfo');
    expect(personalInfoError).toBeDefined();
  });

  it('should reject a non-ISO-8601 education date', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: {},
      education: [
        {
          institution: 'AAU',
          degree: null,
          fieldOfStudy: null,
          startDate: 'not-a-date',
          endDate: null,
        },
      ],
      workExperience: [],
      skills: [],
      certifications: [],
      languages: [],
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'education')).toBeDefined();
  });

  it('should reject compensation with a non-decimal-string amount', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: {},
      education: [],
      workExperience: [
        {
          company: null,
          title: null,
          startDate: null,
          endDate: null,
          description: null,
          compensation: { amount: 'not-a-number', currencyCode: 'ETB' },
        },
      ],
      skills: [],
      certifications: [],
      languages: [],
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'workExperience')).toBeDefined();
  });

  it('should reject a currency code that is not 3 uppercase letters', async () => {
    const dto = plainToInstance(ExtractedResumeDto, {
      personalInfo: {},
      education: [],
      workExperience: [
        {
          company: null,
          title: null,
          startDate: null,
          endDate: null,
          description: null,
          compensation: { amount: '100.00', currencyCode: 'etb' },
        },
      ],
      skills: [],
      certifications: [],
      languages: [],
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'workExperience')).toBeDefined();
  });
});
