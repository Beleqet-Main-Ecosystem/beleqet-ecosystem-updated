import type { PromptTemplate } from '../../prompt-template.interface';

const SYSTEM_PROMPT = `You are a career coach and AI matching expert. Analyze a freelancer's profile and return actionable insights to improve their visibility in AI-powered job matching systems. Respond with valid JSON only.`;

const REQUIRED_VARIABLES = [
  'headline',
  'bio',
  'skills',
  'githubUrl',
  'linkedinUrl',
  'portfolioUrl',
] as const;

const userPrompt = `Analyze this freelancer profile and return JSON with the following fields:

Profile:
Headline: {{headline}}
Bio: {{bio}}
Skills: {{skills}}
Links: GitHub={{githubUrl}} LinkedIn={{linkedinUrl}} Portfolio={{portfolioUrl}}

Return a JSON object with these fields:
- optimizationScore (0-100): How optimized is this profile for AI matching? Consider bio length and quality, skills relevance and count, presence of links, and headline.
- bioQuality ("good" | "needs_improvement" | "poor"): Assess the bio's professionalism, clarity, and keyword richness.
- containsRelevantKeywords (boolean): Does the bio or skills contain modern tech keywords like react, node, typescript, python, docker, aws, api, sql?
- suggestedImprovements (array of strings): 3-5 specific, actionable suggestions to improve this profile. Be concrete.
- trendingSkillsInMarket (array of strings): 3-5 skills that are currently in high demand and relate to this freelancer's existing skill set.`;

/**
 * English-language profile insights prompt template.
 */
export const enInsightsPrompt: PromptTemplate = {
  systemPrompt: SYSTEM_PROMPT,
  userPrompt,
  requiredVariables: REQUIRED_VARIABLES,
} as const;
