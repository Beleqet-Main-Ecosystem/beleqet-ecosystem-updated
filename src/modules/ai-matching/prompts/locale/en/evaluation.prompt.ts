import type { PromptTemplate } from '../../prompt-template.interface';
import { SYSTEM_PROMPT } from '../../system.prompt';

const REQUIRED_VARIABLES = [
  'jobTitle',
  'jobDescription',
  'requiredSkills',
  'candidateTitle',
  'candidateBioSummary',
  'candidateSkills',
  'candidateExperienceYears',
  'candidatePastProjects',
] as const;

const userPrompt = `Evaluate the following freelancer candidate against the job posting.

Job Title: {{jobTitle}}

Job Description:
{{jobDescription}}

Required Skills: {{requiredSkills}}

---
Candidate Profile
---

Title: {{candidateTitle}}

Bio:
{{candidateBioSummary}}

Skills: {{candidateSkills}}
Experience: {{candidateExperienceYears}} years

Past Projects:
{{candidatePastProjects}}

---
Evaluation Instructions
---

Analyse how well this candidate matches the job. Consider:
1. How their skills align with the required skills.
2. Whether their professional experience is relevant.
3. Their past projects as evidence of capability.

Then return:
- A match decision: STRONG_MATCH, POTENTIAL_MATCH, WEAK_MATCH, or NOT_A_MATCH.
- A confidence score between 0.0 and 1.0 reflecting how certain you are.
- Detailed reasoning explaining your assessment.
- Skill gaps — specific required skills the candidate lacks.
- Strengths — areas where the candidate exceeds expectations.`;

/**
 * English-language evaluation prompt template.
 * Exposes a PromptTemplate object ready for interpolation and LLM submission.
 */
export const enEvaluationPrompt: PromptTemplate = {
  systemPrompt: SYSTEM_PROMPT,
  userPrompt,
  requiredVariables: REQUIRED_VARIABLES,
} as const;
