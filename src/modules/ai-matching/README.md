# AI Matching Module

## Purpose

The AI Matching module implements a two-stage pipeline that connects freelancers to jobs by first casting a wide net with vector retrieval, then refining candidates through LLM-based deep evaluation.

Designed to replace or augment the existing search/filter stack with semantic understanding and reasoning.

## Architecture Overview

```
Client Request
     │
     ▼
 Controller ◀─── DTO (validation)
     │
     ▼
   Service ────▶ VectorRetrievalService (stage 1)
     │                  │
     │                  ▼
     │           Vector DB (pgvector)
     │                  │
     │                  ▼
     │           Candidate list (top-K)
     │
     ├──────────── LLMEvaluationService (stage 2)
     │                  │
     │                  ▼
     │           LLM provider (GPT-4o)
     │                  │
     │                  ▼
     │           Decision + reasoning
     │
     ▼
   Mapper ────▶ Response DTO
```

## Pipeline Overview

The matching pipeline is a sequence of stages executed in order. Each stage transforms its input and passes the result to the next stage.

```
                  ┌──────────────────┐
                  │   Job Request     │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │    Embedding      │
                  │    (Stage 1a)     │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │   Vector Search   │
                  │    (Stage 1b)     │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │    Sanitization   │
                  │    (Stage 1c)     │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  LLM Evaluation   │
                  │    (Stage 2)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │     Scoring       │
                  │    (Stage 3)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │     Ranking       │
                  │    (Stage 4)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ Response Mapping  │
                  │    (Stage 5)      │
                  └────────┬─────────┘
                           │
                           ▼
                  Ranked Match Results
```

### Stage 1a — Embedding

The job description is converted into a dense vector embedding using a configured embedding model (e.g., `text-embedding-3-small`). The resulting vector captures semantic meaning beyond keyword overlap.

- Input: raw job text (title + description + required skills)
- Output: embedding vector + metadata payload
- Configurable model per locale (multilingual model for non-English jobs)

### Stage 1b — Vector Search

The embedding vector is queried against the vector index (pgvector or Pinecone) to find freelancer profiles with the most similar embeddings. Results are returned as a ranked list with cosine similarity scores.

- Approximate nearest neighbour (ANN) search with configurable `topK` and `minScore`
- Pre-filtering by skills, hourly rate, location
- Keyword fallback (BM25) for cold-start freelancers who lack embeddings

### Stage 1c — Sanitization

Candidate profiles are sanitized before they reach the LLM to comply with GDPR and data minimisation requirements.

- Strips PII (names, emails, phone numbers, addresses, government IDs)
- Replaces internal IDs with session-scoped opaque tokens
- Redacts portfolio URLs unless the freelancer has opted in
- Truncates project history to the 5 most recent entries
- Excludes freelancers who have opted out of AI matching entirely

### Stage 2 — LLM Evaluation

Each sanitized candidate is sent to an LLM in a structured prompt containing the job details and the freelancer's profile. The LLM returns a match decision with confidence and reasoning.

- Parallel evaluation up to a configurable concurrency limit
- Individual candidate failures do not fail the batch (retry-once with backoff)
- Provider abstraction enables swapping between OpenAI, Groq, Anthropic
- Total batch timeout is configurable

### Stage 3 — Scoring

Vector similarity scores and LLM confidence scores are combined into a single composite score for each candidate.

- `combinedScore = (vectorScore * VECTOR_WEIGHT) + (llmScore * LLM_WEIGHT)`
- Default weights: 0.4 vector / 0.6 LLM (configurable per-job)
- Bypass thresholds skip stage 2 for very strong (≥0.92) or very weak (≤0.25) vector matches, assigning inferred scores directly

### Stage 4 — Ranking

Candidates are sorted by their combined score in descending order. Ties are broken by LLM confidence, then by vector score.

- Results are capped at a configurable maximum return count
- Ranked list is returned to the orchestrator for response construction

### Stage 5 — Response Mapping

The ranked candidate list is transformed into the API response format. Each candidate entry includes:

- Freelancer ID and public profile summary
- Combined score and match decision label
- LLM reasoning snippet (truncated for display)
- Matched skills and identified gaps

- Mapping is performed by a dedicated mapper layer — no business logic involved
- DTOs are validated before returning to the caller

## Folder Responsibilities

| Folder | Purpose |
|--------|---------|
| `config/` | Environment-based configuration (env vars, defaults) |
| `constants/` | Shared constants (queue names, numeric defaults, limits) |
| `controllers/` | Route handlers for matching endpoints |
| `dto/` | Request/response validation schemas (class-validator) |
| `enums/` | Enumerated types (match status, stage, decision) |
| `interfaces/` | TypeScript interfaces for domain objects |
| `mappers/` | Transformers between internal models and DTOs |
| `prompts/` | LLM prompt templates (loaded at startup) |
| `services/` | Business logic (vector retrieval, LLM eval, orchestration) |
| `tests/` | Unit + integration tests |
| `types/` | Type aliases and utility types |
| `utils/` | Pure helper functions (no side effects) |

## Database Schema Changes

To support the AI Matching module, the following changes were made to the Prisma schema:

| Change | Model | Reason |
|--------|-------|--------|
| Added `postgresqlExtensions` & `pgvector` | `generator` / `datasource` | Enables the `pgvector` extension in PostgreSQL to support native vector storage and similarity search. |
| Added `embedding Unsupported("vector(2048)")?` | `User` | Stores the dense vector embedding of the freelancer's sanitized profile (bio, skills, history) for Stage 1 retrieval. |
| Added `embedding Unsupported("vector(2048)")?` | `Job`, `FreelanceJob` | Stores the dense vector embedding of the job post (title, description, required skills) to query against freelancer embeddings. |
| Added `TokenUsageDaily` model | (New Model) | Tracks aggregate LLM token usage (prompt/completion tokens) and estimated USD costs per day for cost monitoring and rate limiting. |

## Deployment Readiness

To ensure the AI Matching module is ready for production deployment, the following configuration and infrastructure requirements have been met:

- **Database Extensibility:** Requires `pgvector` extension. The deployment environment (e.g., `docker-compose.yml`) uses an image that supports it (e.g., `pgvector/pgvector:pg15`).
- **Environment Variables:** The `.env.example` file includes required AI tuning configurations, including `AI_MATCHING_EMBEDDING_MODEL`, prompt/completion token costs, and GDPR-specific logging flags.
- **Error Handling:** External LLM API failures (e.g., JSON parsing issues or provider timeouts) are caught gracefully, logging internal errors without crashing the main application flow.
