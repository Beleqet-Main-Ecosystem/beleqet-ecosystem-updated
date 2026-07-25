# AI Matching — Architecture

## Hybrid Retrieval Pipeline

The matching pipeline combines two retrieval strategies to balance recall (vector search) with precision (LLM evaluation). Every request passes through both stages sequentially unless a shortcut is taken (see Scoring Engine).

```
                         ┌──────────────────┐
                         │  Job Description  │
                         └────────┬─────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │     Stage 1: Retrieval      │
                    │                             │
                    │  ┌──────────────────────┐   │
                    │  │  Embedding Generator  │   │
                    │  └──────────┬───────────┘   │
                    │             │               │
                    │  ┌──────────▼───────────┐   │
                    │  │   Vector DB (ANN)     │   │
                    │  │   pgvector / Pinecone │   │
                    │  └──────────┬───────────┘   │
                    │             │               │
                    │  ┌──────────▼───────────┐   │
                    │  │  Keyword Fallback     │   │
                    │  │  (cold-start / OOV)   │   │
                    │  └──────────┬───────────┘   │
                    │             │               │
                    │             ▼               │
                    │    Top-K Candidates         │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │    Stage 2: Evaluation      │
                    │                             │
                    │  ┌──────────────────────┐   │
                    │  │  LLM Deep Evaluation  │   │
                    │  └──────────┬───────────┘   │
                    │             │               │
                    │             ▼               │
                    │  Decision + Reasoning       │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                         Ranked Results
```

## Vector Search

### Embedding Strategy

Each freelancer profile is converted into a fixed-dimension embedding vector stored in a vector-capable index. Embeddings capture semantic similarity beyond keyword overlap — for example, "React developer with GraphQL experience" will match "frontend engineer building Apollo-powered apps" even when they share zero raw tokens.

- **Profile fields embedded:** bio, skills, past project descriptions, title
- **Job fields embedded:** title, description, required skills
- **Model:** configurable via `AI_MATCHING_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- **Dimensions:** 1536 (OpenAI) or model-dependent

### Index

A dedicated collection/table stores freelancer embeddings with a metadata payload (freelancer ID, skill set, hourly rate range) for post-query filtering. The index supports approximate nearest neighbour (ANN) search with configurable:

- `topK` — number of candidates retrieved (default: 20)
- `minScore` — cosine similarity floor (default: 0.5)
- `filter` — pre-filtering by skills, rate, location

### Keyword Fallback

When the vector index returns fewer than `topK` results (cold-start freelancers, out-of-vocabulary niche skills), a TF-IDF or BM25 keyword pass fills the remaining slots. Scores are normalised to the same `[0, 1]` range so the combined list can be ranked consistently.

## LLM Evaluation

### Per-Candidate Prompting

Each candidate from stage 1 is sent to the LLM in a separate request (parallelised up to a configurable concurrency limit). The prompt contains:

1. Job title and description
2. Required and preferred skills
3. Freelancer bio and skill set
4. Past project titles and descriptions
5. Experience duration and hourly rate

### Response Contract

The LLM responds in a structured format (JSON mode or constrained generation):

```json
{
  "decision": "STRONG_MATCH",
  "confidence": 0.92,
  "reasoning": "The developer has 5 years of React experience...",
  "skillGaps": ["GraphQL"],
  "strengths": ["Full-stack", "Team lead experience"]
}
```

### Provider Abstraction

The LLM provider is injected behind an interface (`AiMatchingChatProvider`) so the system can swap between providers (OpenAI, Groq, Anthropic) without changing evaluation logic. The active provider is selected at startup via configuration.

### Error Handling

- Individual candidate failures do not fail the entire batch
- Failed evaluations include an `error` string in the result
- The orchestrator retries each candidate once with a backoff
- Total batch timeout is configurable

## GDPR Sanitization

### Data Minimisation

Before sending freelancer data to an external LLM provider, the pipeline applies a sanitization layer that:

1. **Strips PII:** Removes names, email addresses, phone numbers, physical addresses, and government IDs from profile text.
2. **Replaces identifiers:** The internal freelancer ID in the prompt is replaced with a session-scoped opaque token.
3. **Redacts URLs:** Portfolio URLs are replaced with placeholder descriptions unless the freelancer has explicitly opted in to share them.
4. **Truncates history:** Only the 5 most recent projects are included (configurable).

### Zero-Logging Mode

When `AI_MATCHING_GDPR_ZERO_LOG` is enabled, the system sets the LLM provider's `logprobs` and retention parameters instructing the provider not to store prompt/response data. Provider APIs that do not support zero-retention are rejected at startup.

### Opt-Out

Freelancers can opt out of AI matching entirely via a `profile.aiMatchingConsent` flag. Opted-out profiles are excluded at the vector query layer, never reaching stage 2.

## Prompt Layer

### Prompt Templates

All LLM prompts live in `src/modules/ai-matching/prompts/` as standalone files loaded at startup into a typed `PromptLibrary` service. This design:

- **Separates concerns:** Engineers can iterate on prompts without touching TypeScript code.
- **Versioning:** Prompts are git-tracked alongside code, enabling PR-based review.
- **Internationalisation:** Each prompt has a locale-aware variant (see Future i18n Support).

### Template Variables

Prompts use a `{{variable}}` syntax. The variable set is defined in `PromptVariables` and validated at prompt load time — any template referencing an undeclared variable raises a startup error.

Current variable slots:

| Variable | Source |
|----------|--------|
| `job_title` | Job.JobTitle |
| `job_description` | Job.Description |
| `required_skills` | Job.RequiredSkills (comma-separated) |
| `freelancer_bio` | Freelancer.Bio (sanitized) |
| `freelancer_skills` | Freelancer.Skills (comma-separated) |
| `experience_years` | Freelancer.ExperienceYears |
| `past_projects` | Freelancer.Projects (sanitized, truncated) |
| `hourly_rate` | Freelancer.HourlyRate |

### System Prompt

A separate system prompt defines the LLM's role, output format, and guardrails. It includes instructions to:

- Return only the structured JSON response
- Not speculate beyond the provided context
- Flag any content that appears harmful or deceptive

## Scoring Engine

### Combined Score

The final rank is computed as a weighted combination of stage 1 and stage 2 scores:

```
combinedScore = (vectorScore * VECTOR_WEIGHT) + (llmScore * LLM_WEIGHT)
```

Default weights are `0.4` for vector and `0.6` for LLM, but these are configurable per-job via a metadata field on the job post.

### Shortcut Bypass

To reduce cost and latency, the orchestrator can skip stage 2 for candidates whose vector score is:

- **Above `bypassHighThreshold`** — the vector match is already very strong; treat as STRONG_MATCH and assign an inferred LLM score of `1.0`
- **Below `bypassLowThreshold`** — the vector match is too weak; treat as NOT_A_MATCH and assign an inferred score of `0.0`

Both thresholds are configurable via `AI_MATCHING_BYPASS_HIGH` (default: `0.92`) and `AI_MATCHING_BYPASS_LOW` (default: `0.25`).

### Confidence Calibration

LLM confidence scores are calibrated against historical accuracy using a running log of accepted matches vs. subsequent dispute/cancellation rate. Calibration produces a corrected score:

```
correctedConfidence = llmConfidence * (1 - historicalErrorRate)
```

Calibration is disabled until at least 100 evaluations have been logged.

## Future i18n Support

### Locale-Aware Prompts

Prompt templates will be stored in locale-specific subdirectories:

```
prompts/
  en/
    evaluation.txt
    system.txt
  am/
    evaluation.txt
    system.txt
```

The `PromptLibrary` service selects the template based on the job's locale (defaulting to English). This enables:

- Evaluating Amharic job descriptions against Amharic freelancer profiles using prompts in the same language
- Generating reasoning in the job's locale for display to employers
- Consistent UX across the platform's multi-language ecosystem

### Embedding Model Locale Support

The embedding model selection will be locale-aware — for Amharic-heavy content, a multilingual model (e.g., `text-embedding-3-large`) will be used instead of the English-optimised default, ensuring retrieval quality is not degraded for non-English languages.

### Locale Metadata

Each evaluation session will carry a `locale` field populated from the job post's language. This field propagates through both stages and is available to every component in the pipeline for locale-specific behaviour.
