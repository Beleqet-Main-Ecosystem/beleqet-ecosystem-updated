import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiProviderError,
  AiUsage,
} from './ai/ai-chat-provider.interface';
import {
  EMPTY_EXTRACTED_RESUME,
  ExtractedEducation,
  ExtractedExperience,
  ExtractedResume,
} from './dto/extracted-resume.dto';

/**
 * Result of a single extraction: the structured resume plus the token usage the
 * provider reported. The usage rides back to {@link ResumeBrainService} so it
 * can meter per-user AI spend without the extractor knowing about budgeting.
 */
export interface ExtractionResult {
  resume: ExtractedResume;
  usage: AiUsage;
}

/**
 * AIExtractorService
 *
 * Phase 4 — its single responsibility is: raw resume text → structured JSON.
 *
 * It does NOT parse files (Phase 3), validate business rules (Phase 5) or know
 * about the database (Phase 6). It asks the configured {@link AiChatProvider}
 * for JSON matching {@link ExtractedResume}, then *normalises* the reply into
 * that exact shape so every downstream consumer (validator, mapper, frontend)
 * receives a well-formed object with no missing or mistyped fields.
 */
@Injectable()
export class AIExtractorService {
  private readonly logger = new Logger(AIExtractorService.name);

  constructor(
    @Inject(AI_CHAT_PROVIDER) private readonly provider: AiChatProvider,
  ) {}

  /** Provider name (e.g. "groq") for logging / `modelUsed` metadata. */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Extract a structured resume from plain text.
   *
   * @throws ServiceUnavailableException when the AI provider is down/unset.
   * @throws HttpException(429) when the provider is rate-limited.
   * @throws UnprocessableEntityException when the reply is not usable JSON.
   */
  async extract(text: string): Promise<ExtractionResult> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new UnprocessableEntityException(
        'Cannot extract a profile from empty resume text.',
      );
    }

    // Cap the prompt size — resumes are short, and this bounds token cost —
    // then neutralise the most common prompt-injection payloads. The low
    // temperature (0.1) and strict "return ONLY JSON" schema already resist
    // hijacking; stripping these phrases is defence in depth against a resume
    // whose text tries to override our instructions.
    const resumeText = this.sanitize(trimmed.slice(0, 12_000));

    let raw: string;
    let usage: AiUsage;
    try {
      const completion = await this.provider.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: this.buildUserPrompt(resumeText) },
        ],
        { json: true, temperature: 0.1, maxTokens: 1500 },
      );
      raw = completion.content;
      usage = completion.usage;
    } catch (err) {
      throw this.toHttpException(err);
    }

    // Best-effort parse. If the model ignored us and returned non-JSON, we do
    // NOT throw here — we return an empty profile and let ResumeValidatorService
    // (Phase 5) reject it with a 400. Keeps rejection in one place.
    const parsed = this.parseJson(raw) ?? {};
    const resume = this.normalize(parsed);

    this.logger.log(
      `Extracted resume via ${this.provider.name}: ` +
        `${resume.skills.length} skills, ${resume.experience.length} roles, ` +
        `${resume.education.length} education entries ` +
        `(${usage.totalTokens} tokens).`,
    );
    return { resume, usage };
  }

  /**
   * Strip the best-known prompt-injection markers from untrusted resume text so
   * a crafted document cannot steer the extractor. Case-insensitive; collapses
   * the phrase to a space rather than deleting so surrounding words stay legible.
   */
  private sanitize(text: string): string {
    return text
      .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, ' ')
      .replace(/disregard\s+(all\s+)?(previous|prior)\s+instructions/gi, ' ')
      .replace(/^\s*system\s*:/gim, ' ')
      .replace(/^\s*assistant\s*:/gim, ' ')
      .trim();
  }

  // ── Prompt ────────────────────────────────────────────────────────────────

  private buildUserPrompt(resumeText: string): string {
    return (
      'Extract the candidate profile from the following resume text and return ' +
      'it as JSON matching the schema exactly.\n\n' +
      '=== RESUME START ===\n' +
      resumeText +
      '\n=== RESUME END ==='
    );
  }

  // ── Parsing & normalisation ────────────────────────────────────────────────

  /**
   * Parse the model reply into an object. We ask for a JSON object, but stay
   * defensive: strip any ```json fences and, as a last resort, pull the first
   * balanced `{ … }` block out of the text. Returns `null` when nothing usable
   * can be parsed (caller falls back to an empty profile).
   */
  private parseJson(raw: string): Record<string, unknown> | null {
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const candidates = [cleaned, this.firstJsonObject(cleaned)];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const value = JSON.parse(candidate);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return value as Record<string, unknown>;
        }
      } catch {
        // try the next candidate
      }
    }

    this.logger.warn('AI reply was not valid JSON; returning empty profile.');
    return null;
  }

  /** Return the substring from the first `{` to its matching `}`, or null. */
  private firstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) {
        return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /**
   * Coerce an arbitrary parsed object into a complete {@link ExtractedResume}.
   * Guarantees every field exists with the right type — the contract every
   * downstream consumer (DB mapper, frontend autofill) relies on.
   */
  private normalize(data: Record<string, unknown>): ExtractedResume {
    return {
      ...EMPTY_EXTRACTED_RESUME,
      firstName: this.str(data.firstName),
      lastName: this.str(data.lastName),
      email: this.str(data.email),
      phone: this.str(data.phone),
      summary: this.str(data.summary),
      headline: this.str(data.headline),
      location: this.str(data.location),
      skills: this.strArray(data.skills),
      languages: this.strArray(data.languages),
      certifications: this.strArray(data.certifications),
      education: this.educationArray(data.education),
      experience: this.experienceArray(data.experience),
    };
  }

  private str(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private strArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.str(item))
      .filter((item) => item.length > 0);
  }

  private educationArray(value: unknown): ExtractedEducation[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const obj = (item ?? {}) as Record<string, unknown>;
        return {
          school: this.str(obj.school ?? obj.institution),
          qualification: this.str(obj.qualification ?? obj.degree),
          year: this.str(obj.year ?? obj.graduationYear),
        };
      })
      .filter((e) => e.school || e.qualification || e.year);
  }

  private experienceArray(value: unknown): ExtractedExperience[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const obj = (item ?? {}) as Record<string, unknown>;
        return {
          role: this.str(obj.role ?? obj.title ?? obj.position),
          company: this.str(obj.company ?? obj.employer ?? obj.organization),
          start: this.str(obj.start ?? obj.startDate),
          end: this.str(obj.end ?? obj.endDate),
          description: this.str(obj.description ?? obj.summary),
        };
      })
      .filter((e) => e.role || e.company || e.description);
  }

  // ── Error mapping ──────────────────────────────────────────────────────────

  private toHttpException(err: unknown): HttpException {
    if (err instanceof AiProviderError) {
      if (err.status === HttpStatus.TOO_MANY_REQUESTS) {
        return new HttpException(
          'AI capacity reached. Please try again shortly.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return new ServiceUnavailableException(
        'The resume AI service is temporarily unavailable.',
      );
    }
    this.logger.error(`Unexpected AI extraction error: ${(err as Error).message}`);
    return new ServiceUnavailableException(
      'The resume AI service is temporarily unavailable.',
    );
  }
}

/**
 * System prompt. Pins the model to a single job and the exact output schema.
 * The schema mirrors {@link ExtractedResume} so the reply drops straight into
 * the pipeline.
 */
const SYSTEM_PROMPT = `You are a resume parser. Read the resume text and return ONLY valid JSON — no markdown, no code fences, no commentary.

Use this exact schema and these exact keys:
{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "summary": "",
  "headline": "",
  "location": "",
  "skills": [],
  "languages": [],
  "certifications": [],
  "education": [{ "school": "", "qualification": "", "year": "" }],
  "experience": [{ "role": "", "company": "", "start": "", "end": "", "description": "" }]
}

Rules:
- Output a single JSON object, nothing else.
- Use "" for any string you cannot find and [] for any list you cannot find.
- "summary" is a short professional summary; "headline" is the person's job title.
- "skills", "languages" and "certifications" are arrays of short strings.
- Never invent facts. Only use information present in the resume.`;
