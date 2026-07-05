# Plagiarism Scout — Simple Guide

**Author:** Mikiyas Getnet  
**Module:** Plagiarism Scout (The Brain — AI & Logic)  
**Task:** Check if text is copied from other platform content or from the internet.

---

## What is this module?

This module checks text (job descriptions, cover letters, profiles, etc.) and finds how similar it is to other content already on Beleqet or on public web pages.

It does **not** use AI. It uses a simple math method called **Jaccard similarity** to compare words.

---

## What does it check?

### 1. Platform database (Beleqet)

It reads text from these tables in PostgreSQL:

| What | Where in database | Text used |
|------|-------------------|-----------|
| Job posts | `Job` | title, description, requirements |
| Freelance jobs | `FreelanceJob` | title, description |
| Job applications | `Application` | cover letter |
| Freelance bids | `Bid` | cover letter |
| User profiles | `User` | bio, headline |
| Company profiles | `Company` | description |

It loads the **latest 100 records** per type to keep checks fast.

### 2. Internet (optional)

If you send `sourceUrls` in the request, it downloads those web pages, removes HTML tags, and compares the plain text.

---

## How does it check? (Step by step)

```
1. You send text  →  POST /plagiarism/check
2. Text is split into words (tokens)
3. Small/common words are removed (stop words like "the", "and", "is")
4. Your text is compared to every platform document + every URL
5. Each comparison gets a score from 0 to 1
6. Matches above the threshold are listed in the report
7. Result is saved in history (EventLog table)
8. Report is sent back to you
```

### Similarity score

- **0** = no shared words  
- **1** = same words (very similar or copied)  
- **0.25** = default minimum to show a match  

### Quality verdict

| Highest score | Verdict |
|---------------|---------|
| Below 0.35 | `original` — looks unique |
| 0.35 to 0.59 | `suspicious` — some overlap |
| 0.60 and above | `likely_plagiarized` — strong overlap |

---

## Files in this folder

| File / folder | What it does |
|---------------|--------------|
| `plagiarism.module.ts` | Registers all services and the controller |
| `plagiarism.controller.ts` | REST API endpoints |
| `plagiarism.service.ts` | Main logic — runs the full check |
| `dto/check-plagiarism.dto.ts` | Validates incoming requests |
| `tokenizer/` | Turns text into clean word lists |
| `similarity.service.ts/` | Jaccard algorithm to compare two texts |
| `sources/platform-source.service.ts` | Loads text from the database |
| `sources/internet-source.service.ts` | Fetches text from URLs |
| `history/history.service.ts` | Saves and loads past check results |
| `types/plagiarism.types.ts` | TypeScript types for reports |

---

## API endpoints

### 1. Run a check

```
POST /plagiarism/check
```

**Body example:**

```json
{
  "text": "We need a NestJS developer with PostgreSQL experience...",
  "contentType": "JOB_DESCRIPTION",
  "excludeEntityId": "optional-id-to-skip",
  "sourceUrls": ["https://example.com/some-page"],
  "threshold": 0.25
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `text` | Yes | Text to check (50–50,000 characters) |
| `contentType` | No | Type of content (job, profile, cover letter, etc.) |
| `excludeEntityId` | No | Skip this record (e.g. when editing your own job) |
| `sourceUrls` | No | Web pages to compare against |
| `threshold` | No | Minimum score to include a match (default: 0.25) |

**Response example:**

```json
{
  "checkId": "uuid-here",
  "inputLength": 250,
  "maxSimilarity": 0.72,
  "averageSimilarity": 0.45,
  "matchCount": 3,
  "verdict": "likely_plagiarized",
  "matches": [
    {
      "sourceType": "platform",
      "entityType": "Job",
      "entityId": "job-id",
      "title": "Backend Developer",
      "similarity": 0.72,
      "matchedTokens": ["nestjs", "postgresql", "developer"]
    }
  ],
  "checkedAt": "2026-07-05T10:00:00.000Z"
}
```

### 2. Get check history

```
GET /plagiarism/history?limit=20
```

Returns the most recent check reports.

### 3. Get one check by ID

```
GET /plagiarism/history/:checkId
```

Returns a single saved report.

---

## Where is history stored?

Results are saved in the **`EventLog`** table (`events_log`):

- `eventType` = `PLAGIARISM_CHECK`
- `entityType` = `PlagiarismCheck`
- `payload` = full JSON report

No new database table was added. This reuses the existing event log.

---

## How to enable the module

Add `PlagiarismModule` to `app.module.ts`:

```typescript
import { PlagiarismModule } from './modules/plagiarism/plagiarism.module';

// inside imports: [...]
PlagiarismModule,
```

---

## Run tests

```bash
npm test -- --testPathPattern=plagiarism
```

Tests cover the Jaccard similarity logic (unrelated text, identical text, partial overlap).

---



*Built for Beleqet second-round assessment — Plagiarism Scout module.*
