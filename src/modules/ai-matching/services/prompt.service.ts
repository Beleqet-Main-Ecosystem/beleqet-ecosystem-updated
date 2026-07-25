import { Injectable } from '@nestjs/common';
import type { JobSummary } from '../interfaces/job.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import type { PromptTemplate } from '../prompts/prompt-template.interface';
import type { PromptVariables } from '../types/prompt-variable.type';
import { getEvaluationPrompt, getInsightsPrompt } from '../prompts/prompt-registry';
import { normalizeTextArray } from '../utils/text-normalizer.util';

/**
 * Builds evaluation prompts by interpolating job and candidate data
 * into locale-specific prompt templates from the prompt registry.
 */
@Injectable()
export class PromptService {
  /**
   * Construct a fully interpolated PromptTemplate for LLM evaluation.
   *
   * @param job      - Job summary with title, description, and required skills.
   * @param candidate - Sanitized candidate profile (PII-free).
   * @param locale   - Locale code for prompt selection (e.g., "en", "am").
   * @returns A PromptTemplate with all {{variable}} placeholders replaced.
   */
  buildEvaluationPrompt(
    job: JobSummary,
    candidate: LlmCandidateProfile,
    locale: string,
  ): PromptTemplate {
    const template = getEvaluationPrompt(locale);

    const variables: PromptVariables = {
      jobTitle: job.title,
      jobDescription: job.description,
      requiredSkills: normalizeTextArray(job.requiredSkills).join(', '),
      candidateTitle: candidate.title,
      candidateBioSummary: candidate.bioSummary,
      candidateSkills: normalizeTextArray(candidate.skills).join(', '),
      candidateExperienceYears: String(candidate.experienceYears),
      candidatePastProjects: normalizeTextArray(candidate.pastProjectsSummary).join('\n'),
    };

    let userPrompt = template.userPrompt;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replaceAll(`{{${key}}}`, value);
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
      requiredVariables: template.requiredVariables,
    };
  }

  /**
   * Construct a fully interpolated PromptTemplate for profile insights analysis.
   *
   * @param user - Freelancer profile data (headline, bio, skills, links).
   * @returns A PromptTemplate with all {{variable}} placeholders replaced.
   */
  buildInsightsPrompt(user: {
    headline: string | null;
    bio: string | null;
    skills: readonly string[];
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
  }): PromptTemplate {
    const template = getInsightsPrompt();

    const variables: Record<string, string> = {
      headline: user.headline ?? '(not set)',
      bio: user.bio ?? '(not set)',
      skills: normalizeTextArray([...user.skills]).join(', ') || '(none)',
      githubUrl: user.githubUrl ?? '(not set)',
      linkedinUrl: user.linkedinUrl ?? '(not set)',
      portfolioUrl: user.portfolioUrl ?? '(not set)',
    };

    let userPrompt = template.userPrompt;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replaceAll(`{{${key}}}`, value);
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
      requiredVariables: template.requiredVariables,
    };
  }
}
