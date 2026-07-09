import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import OpenAI from 'openai';
import { ExtractedResumeDto } from '../dto/extracted-resume.dto';
import { ResumeExtractionProvider } from './resume-extraction-provider.interface';

const SYSTEM_PROMPT =
  'You are a precise résumé/CV parsing assistant for an Ethiopian hiring platform called Beleqet. ' +
  'Given raw CV text, extract structured data and respond ONLY with a single valid JSON object, ' +
  'no markdown fences, no commentary. Use null for any field you cannot find — never guess or invent ' +
  'information that is not present in the text. Every date must be formatted as ISO 8601 ("YYYY-MM-DD"); ' +
  'if only a year or month is known, use the first day of that period. If a role mentions a salary or ' +
  'compensation figure, express it as {"amount": "<decimal string, e.g. \\"45000.00\\">", "currencyCode": ' +
  '"<ISO 4217 code>"} — never a bare number, and omit it entirely if no figure is mentioned.';

/**
 * OpenAI-backed implementation of `ResumeExtractionProvider`. Uses JSON mode
 * with a low temperature to keep extraction deterministic and grounded in
 * the source text.
 */
@Injectable()
export class OpenAiResumeExtractionProvider implements ResumeExtractionProvider {
  readonly engineId: string;
  private readonly logger = new Logger(OpenAiResumeExtractionProvider.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.engineId = `openai:${this.model}`;
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY') || 'dummy_key_for_testing',
    });
  }

  /** @inheritdoc */
  async extract(resumeText: string): Promise<ExtractedResumeDto> {
    const userPrompt = `Extract the following JSON structure from this CV text:
{
  "personalInfo": { "fullName": string|null, "email": string|null, "phone": string|null, "location": string|null },
  "education": [{ "institution": string|null, "degree": string|null, "fieldOfStudy": string|null, "startDate": string|null, "endDate": string|null }],
  "workExperience": [{ "company": string|null, "title": string|null, "startDate": string|null, "endDate": string|null, "description": string|null, "compensation": {"amount": string, "currencyCode": string}|null }],
  "skills": [string],
  "certifications": [string],
  "languages": [{ "language": string|null, "proficiency": string|null }]
}

CV text:
"""
${resumeText.slice(0, 12000)}
"""`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.toSafeDto(parsed);
    } catch (err) {
      this.logger.error(
        `OpenAI resume extraction failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return this.toSafeDto({});
    }
  }

  /**
   * Normalizes a raw parsed JSON object into `ExtractedResumeDto`, filling in
   * empty defaults for anything missing so extraction never crashes on
   * incomplete AI output.
   */
  private toSafeDto(parsed: Record<string, unknown>): ExtractedResumeDto {
    return plainToInstance(ExtractedResumeDto, {
      personalInfo: parsed.personalInfo ?? {},
      education: Array.isArray(parsed.education) ? parsed.education : [],
      workExperience: Array.isArray(parsed.workExperience) ? parsed.workExperience : [],
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s) => typeof s === 'string')
        : [],
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.filter((c) => typeof c === 'string')
        : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    });
  }
}
