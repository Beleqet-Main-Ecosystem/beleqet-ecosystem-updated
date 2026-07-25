import type { PromptTemplate } from './prompt-template.interface';
import { enEvaluationPrompt } from './locale/en/evaluation.prompt';
import { amEvaluationPrompt } from './locale/am/evaluation.prompt';
import { enInsightsPrompt } from './locale/en/insights.prompt';

const SUPPORTED_LOCALES: Record<string, PromptTemplate> = {
  en: enEvaluationPrompt,
  am: amEvaluationPrompt,
} as const;

/**
 * Return the appropriate evaluation prompt for the given locale.
 * Falls back to English ('en') when the locale is unsupported or not provided.
 *
 * @param locale - Locale code (e.g., "en", "am"). Case-sensitive.
 * @returns A PromptTemplate ready for variable interpolation.
 */
export function getEvaluationPrompt(locale: string): PromptTemplate {
  return SUPPORTED_LOCALES[locale] ?? enEvaluationPrompt;
}

/**
 * Return the profile insights prompt (English only).
 * Used by InsightsService to analyze freelancer profiles via LLM.
 */
export function getInsightsPrompt(): PromptTemplate {
  return enInsightsPrompt;
}
