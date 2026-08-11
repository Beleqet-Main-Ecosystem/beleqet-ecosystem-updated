# Resume Brain — Database Schema

Two additive tables were introduced by migration `20260709120000_add_resume_brain`. No
existing table was altered. Both tables cascade-delete when the owning `users` row is
deleted, and cascade-delete together when a `resume_uploads` row is deleted (GDPR
right-to-erasure only has to remove one row to remove everything it owns).

## `resume_uploads`

Raw upload metadata for a CV/resume file. The binary file itself lives in object storage
(S3/R2 via the existing `UploadsService`); this table never stores file bytes.

| Column             | Type                 | Notes                                                                 |
|--------------------|----------------------|------------------------------------------------------------------------|
| `id`               | `TEXT` (uuid)        | Primary key.                                                          |
| `userId`           | `TEXT`               | FK → `users.id`, `ON DELETE CASCADE`. Owning professional.            |
| `originalFilename` | `TEXT`               | Sanitized (path-stripped, extension-checked) original filename.       |
| `storageKey`       | `TEXT`               | Object storage key. UUID-based, never derived from user input.        |
| `storageUrl`       | `TEXT`               | Public/signed URL returned by `UploadsService`.                       |
| `mimeType`         | `TEXT`               | Detected MIME type; one of the PDF/DOC/DOCX whitelist.                |
| `fileSizeBytes`    | `INTEGER`            | Enforced against the configured max upload size.                      |
| `status`           | `ResumeUploadStatus` | `PENDING` \| `PARSING` \| `PARSED` \| `FAILED`.                        |
| `consentGiven`     | `BOOLEAN`            | GDPR explicit consent flag, required `true` to accept the upload.     |
| `consentAt`        | `TIMESTAMP`          | When consent was recorded.                                            |
| `failureReason`    | `TEXT`, nullable     | Populated when `status = FAILED` (corrupt file, timeout, etc.).       |
| `createdAt`        | `TIMESTAMP`          |                                                                        |
| `updatedAt`        | `TIMESTAMP`          |                                                                        |

**Indexes**
- `resume_uploads_userId_createdAt_idx` — a user's upload history, most recent first.
- `resume_uploads_status_idx` — ops/admin filtering by pipeline status.

**Relations**
- `resume_uploads.userId` → `users.id` (many uploads per user).
- `resume_uploads` 1:1 `parsed_resumes` (an upload has at most one parsed result).

## `parsed_resumes`

Structured output of the extraction engine for one `resume_uploads` row. Field shape
matches `ExtractedResumeDto` exactly (see module README) — this is intentional data
minimization: only the fields defined in the schema are ever persisted, nothing else
from the source document.

| Column             | Type          | Notes                                                                 |
|---------------------|--------------|------------------------------------------------------------------------|
| `id`                | `TEXT` (uuid) | Primary key.                                                           |
| `resumeUploadId`    | `TEXT`        | FK → `resume_uploads.id`, unique, `ON DELETE CASCADE`.                 |
| `userId`            | `TEXT`        | FK → `users.id`, `ON DELETE CASCADE`. Denormalized to avoid a join on user-scoped reads. |
| `personalInfo`      | `JSONB`       | `{ fullName, email, phone, location }`, all nullable.                  |
| `education`         | `JSONB`       | Array of `{ institution, degree, fieldOfStudy, startDate, endDate }`.  |
| `workExperience`    | `JSONB`       | Array of `{ company, title, startDate, endDate, description, compensation? }`. `compensation`, when present, is always `{ amount: "<decimal string>", currencyCode: "<ISO 4217>" }` — never a bare number. |
| `skills`            | `TEXT[]`      | Default `[]`.                                                          |
| `certifications`    | `TEXT[]`      | Default `[]`.                                                          |
| `languages`         | `JSONB`       | Array of `{ language, proficiency }`.                                  |
| `extractionEngine`  | `TEXT`        | Identifier of the provider that produced the result (e.g. `openai:gpt-4o-mini`, `mock`) — the extraction engine is swappable behind `ResumeExtractionProvider`. |
| `createdAt`         | `TIMESTAMP`   |                                                                         |
| `updatedAt`         | `TIMESTAMP`   |                                                                         |

**Indexes**
- `parsed_resumes_resumeUploadId_key` — unique, enforces the 1:1 with `resume_uploads`.
- `parsed_resumes_userId_createdAt_idx` — a user's parsed resumes, most recent first.

## Audit trail

Resume Brain does not introduce a new audit table. It reuses the existing generic
`events_log` table (`eventType`, `entityId`, `entityType`, `payload`, `processedBy`,
`createdAt`) already used by other modules (e.g. `kyc`, `screening`). Events emitted:
`resume.uploaded`, `resume.parsed`, `resume.parse_failed`, `resume.deleted`,
`profile.autofilled`.

## Retention policy

See "GDPR" section of `src/modules/resume-brain/README.md`.
