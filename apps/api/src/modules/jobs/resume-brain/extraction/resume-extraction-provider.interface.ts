import { ExtractedResumeDto } from '../dto/extracted-resume.dto';

/**
 * Converts raw CV text into the structured `ExtractedResumeDto` shape.
 * Implementations are swappable (OpenAI, a local model, a mock for
 * development/tests, ...) and are selected by `ResumeBrainModule`'s
 * provider factory, mirroring the `KycProvider` pattern used by the KYC module.
 */
export interface ResumeExtractionProvider {
  /** Identifier persisted alongside the result, e.g. `"openai:gpt-4o-mini"` or `"mock"`. */
  readonly engineId: string;

  /**
   * Extracts structured resume data from plain CV text.
   *
   * @param resumeText - Plain text extracted from the uploaded CV file.
   * @returns Structured resume data. Every field is optional/nullable — the
   *          provider must never throw solely because a section is missing
   *          from the source document.
   */
  extract(resumeText: string): Promise<ExtractedResumeDto>;
}
