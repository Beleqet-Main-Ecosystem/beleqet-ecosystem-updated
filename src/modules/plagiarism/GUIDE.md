# Plagiarism Scout — Backend Developer Guide

**Author:** Mikiyas Getnet
**Module:** Plagiarism Scout (The Brain — AI & Logic)

## Overview

Plagiarism Scout is a NestJS module that detects copied, paraphrased, and highly similar content by comparing submitted text against both Beleqet platform data and publicly available internet sources. It combines multiple similarity algorithms, generates a quality assessment, and stores analysis history for future retrieval.

---

## Architecture

```text
Input Text
    ↓
Normalization
    ↓
Chunking
    ↓
Platform Source Collection ──┐
Internet Source Collection ──┤ (parallel)
    ↓
Similarity Engines
 • Jaccard
 • Cosine TF-IDF
 • Character N-Gram
 • Semantic Embeddings
    ↓
Weighted Score Aggregation
    ↓
Quality Assessment
    ↓
Report Generation
    ↓
History Storage (EventLog)
```

---

## Module Structure

| Path                       | Responsibility                           |
| -------------------------- | ---------------------------------------- |
| `plagiarism.controller.ts` | REST API endpoints                       |
| `plagiarism.service.ts`    | Main plagiarism pipeline                 |
| `plagiarism.module.ts`     | Module registration                      |
| `dto/`                     | Request validation                       |
| `types/`                   | Shared interfaces                        |
| `utils/`                   | Helpers and configuration                |
| `tokenizer/`               | Tokenization and stop-word removal       |
| `chunker/`                 | Paragraph and sentence chunking          |
| `platform/`                | Platform data collection                 |
| `internet/`                | Internet search and page extraction      |
| `similarity/`              | Similarity algorithms and aggregation    |
| `report/`                  | Report and quality assessment generation |
| `history/`                 | EventLog persistence                     |

---

## Similarity Algorithms

| Algorithm           | Weight | Purpose                    |
| ------------------- | ------ | -------------------------- |
| Jaccard             | 20%    | Detect exact token overlap |
| Cosine TF-IDF       | 25%    | Detect similar wording     |
| Character N-Gram    | 20%    | Detect copied phrases      |
| Semantic Embeddings | 35%    | Detect paraphrased content |

Semantic similarity uses the local `Xenova/all-MiniLM-L6-v2` model through `@xenova/transformers` without requiring external AI services.

---

## Platform Sources

The module compares submitted content against:

* Job
* FreelanceJob
* Application
* Bid
* User
* Company

Relevant text fields (title, description, requirements, cover letters, bio, etc.) are automatically extracted for comparison.

---

## Internet Sources

When enabled, the module:

1. Extracts keywords from the input.
2. Searches the configured provider.
3. Downloads public webpages.
4. Extracts readable content.
5. Performs similarity analysis.

Supported providers:

* DuckDuckGo (default)
* Brave Search
* SearXNG

Internet search can be disabled using:

```text
ENABLE_WEB_SEARCH=false
```

---

## Configuration

| Variable                 | Default      |
| ------------------------ | ------------ |
| `PLAGIARISM_THRESHOLD`   | `0.25`       |
| `ENABLE_WEB_SEARCH`      | `true`       |
| `SEARCH_PROVIDER`        | `duckduckgo` |
| `MAX_PLATFORM_DOCUMENTS` | `100`        |
| `MAX_WEB_RESULTS`        | `5`          |
| `VERDICT_ORIGINAL_MAX`   | `0.30`       |
| `VERDICT_SUSPICIOUS_MAX` | `0.60`       |
| `EARLY_EXIT_THRESHOLD`   | `0.05`       |

---

## API Endpoints

### POST `/plagiarism/check`

Runs plagiarism analysis on submitted text.

### GET `/plagiarism/history`

Returns recent plagiarism reports.

### GET `/plagiarism/history/:checkId`

Returns a previously generated report.

---

## Verdict Logic

| Similarity | Verdict              |
| ---------- | -------------------- |
| 0–30%      | `original`           |
| 30–60%     | `suspicious`         |
| 60–100%    | `likely_plagiarized` |

---

## Quality Assessment

Each report includes:

* Originality
* Professional Language
* Readability
* Content Completeness
* Duplicate Sentences
* Grammar Warnings

---

## History Storage

Results are stored in the existing `EventLog` table.

* `eventType = PLAGIARISM_CHECK`
* `entityType = PlagiarismCheck`
* `payload = Full analysis report`

No additional database tables are required.

---

## Performance Optimizations

* Parallel source collection
* Parallel document comparison
* Chunk-level matching
* Tokenizer caching
* Early semantic comparison exit
* Configurable document limits

---

## Testing

The module includes Jest unit tests covering:

* Tokenization
* Chunking
* Similarity algorithms
* Score aggregation
* Verdict generation
* Report builder
* Controller and service behavior

Run tests:

```bash
npm test
```

Generate coverage:

```bash
npm run test:cov
```

---

## Deployment

The module is production-ready and supports:

* Docker deployment
* Environment-based configuration
* Stateless REST API
* Configurable similarity thresholds
* Configurable search providers
* Modular NestJS architecture
* Automated testing
