import { MockResumeExtractionProvider } from './mock-resume-extraction.provider';
import { SAMPLE_RESUME_TEXT } from '../fixtures/sample-resume-text';

describe('MockResumeExtractionProvider', () => {
  let provider: MockResumeExtractionProvider;

  beforeEach(() => {
    provider = new MockResumeExtractionProvider();
  });

  it('should expose a stable engineId', () => {
    expect(provider.engineId).toBe('mock');
  });

  it('should extract an email and phone number from CV text via regex', async () => {
    const result = await provider.extract(SAMPLE_RESUME_TEXT);

    expect(result.personalInfo.email).toBe('selam.tesfaye@example.com');
    expect(result.personalInfo.phone).toBe('+251911223344');
    expect(result.personalInfo.fullName).toBe('Selam Tesfaye');
  });

  it('should never crash and return empty defaults on unrecognizable text', async () => {
    const result = await provider.extract('   ');

    expect(result.personalInfo.email).toBeNull();
    expect(result.personalInfo.phone).toBeNull();
    expect(result.education).toEqual([]);
    expect(result.workExperience).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.languages).toEqual([]);
  });
});
