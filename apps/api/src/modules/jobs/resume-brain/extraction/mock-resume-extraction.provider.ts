import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ExtractedResumeDto } from '../dto/extracted-resume.dto';
import { ResumeExtractionProvider } from './resume-extraction-provider.interface';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d[\d\s\-().]{7,}\d)/;

/**
 * Lightweight heuristic implementation of `ResumeExtractionProvider` used
 * automatically in development/test environments when no OpenAI API key is
 * configured, and directly in unit tests. Extracts only what simple regex
 * matching can reliably find; everything else is left null/empty rather than
 * guessed.
 */
@Injectable()
export class MockResumeExtractionProvider implements ResumeExtractionProvider {
  readonly engineId = 'mock';

  /** @inheritdoc */
  async extract(resumeText: string): Promise<ExtractedResumeDto> {
    const email = resumeText.match(EMAIL_REGEX)?.[0] ?? null;
    const phone = resumeText.match(PHONE_REGEX)?.[0]?.trim() ?? null;
    const firstLine =
      resumeText
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? null;

    return plainToInstance(ExtractedResumeDto, {
      personalInfo: {
        fullName: firstLine,
        email,
        phone,
        location: null,
      },
      education: [],
      workExperience: [],
      skills: [],
      certifications: [],
      languages: [],
    });
  }
}
