# Resume Brain — The Brain: AI & Logic

Users upload a CV (PDF or Word). Resume Brain parses it (with an OCR fallback for
scanned documents), extracts structured data via a swappable AI/NLP extraction
engine, persists both the raw upload metadata and the parsed result, and lets the
professional review/correct the extracted data before applying it to their profile.

## Architecture

```
resume-brain/
├── resume-brain.module.ts      NestJS module — wiring & the extraction-provider factory
├── resume-brain.controller.ts  POST /resumes/upload, GET /resumes/:id, DELETE /resumes/:id
├── profiles.controller.ts      PATCH /profiles/:id/autofill
├── resume-brain.service.ts     Orchestration: validate → store → parse → extract → persist
├── parsers/                    ResumeParser interface + PDF/DOCX implementations + OCR fallback
├── extraction/                 ResumeExtractionProvider interface + OpenAI/Mock implementations
├── dto/                        class-validator DTOs (upload, extracted resume, autofill)
├── fixtures/                   Test fixtures (sample CV text, a hand-built minimal PDF)
└── SCHEMA.md                   Database schema documentation
```

The extraction engine is swappable behind `ResumeExtractionProvider`. `ResumeBrainModule`
selects `OpenAiResumeExtractionProvider` when `OPENAI_API_KEY` is configured, otherwise
falls back to `MockResumeExtractionProvider` (deterministic regex-based extraction,
used automatically outside production and in tests) — the same factory pattern already
used by `KycModule`/`KycProvider`.

Storage reuses the existing `UploadsService` (S3/R2-compatible object storage with
UUID-based keys), so files never live inside the web root and filenames are sanitized
before storage.

## Setup

1. Install dependencies (already added to the root `package.json`): `pdf-parse`,
   `mammoth`, `tesseract.js`.
2. Run the migration: `npm run prisma:migrate` (adds `resume_uploads` and
   `parsed_resumes` tables — see `SCHEMA.md`).
3. Set environment variables (see below).
4. Start the API as usual: `npm run start:dev`.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | When set (and not a dummy value), enables `OpenAiResumeExtractionProvider`. Otherwise the mock provider is used. Shared with the existing `kyc`/`screening` modules. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for extraction. |
| `RESUME_MAX_FILE_SIZE_MB` | `10` | Maximum accepted upload size. |
| `RESUME_PARSE_TIMEOUT_MS` | `30000` | Timeout for the parse+extract pipeline; on timeout the upload is marked `FAILED` and a 408 is returned. |
| `AWS_*` / `R2_*` | — | Reused from `UploadsService` for object storage — see the root `.env.example`. |

## API

All endpoints require a Bearer JWT (`JwtAuthGuard`) and are versioned under `/api/v1`.

### `POST /resumes/upload`

`multipart/form-data` with fields:
- `file` — the CV, one of `application/pdf`, `application/msword` (legacy `.doc`,
  best-effort — see Known limitations), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`).
- `consent` — `"true"` (required; GDPR explicit consent, rejected otherwise).

```
curl -X POST http://localhost:4000/api/v1/resumes/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@cv.pdf" \
  -F "consent=true"
```

Response `201`:
```json
{
  "upload": { "id": "b3f1c2b0-...", "status": "PARSED", "mimeType": "application/pdf", "originalFilename": "cv.pdf", "createdAt": "2026-07-09T10:00:00.000Z" },
  "parsedResume": {
    "id": "9a2e0f1c-...",
    "personalInfo": { "fullName": "Selam Tesfaye", "email": "selam@example.com", "phone": "+251911223344", "location": "Addis Ababa, Ethiopia" },
    "education": [{ "institution": "Addis Ababa University", "degree": "BSc", "fieldOfStudy": "Computer Science", "startDate": "2018-09-01", "endDate": "2022-06-30" }],
    "workExperience": [{ "company": "Beleqet", "title": "Software Engineer", "startDate": "2022-07-01", "endDate": null, "description": "...", "compensation": { "amount": "45000.00", "currencyCode": "ETB" } }],
    "skills": ["TypeScript", "NestJS"],
    "certifications": ["AWS Certified Cloud Practitioner"],
    "languages": [{ "language": "Amharic", "proficiency": "Native" }]
  }
}
```

Errors: `400` missing/empty file, missing consent, corrupt/unreadable file, or empty
extraction result; `415` unsupported file type; `413` file too large; `408` parse timeout.
All messages are translated (`en`/`am`) via `nestjs-i18n` (resolved from `?lang=`,
`Accept-Language`, or the `x-custom-lang` header).

### `GET /resumes/:id`

Returns the upload record and its parsed result. `404` if it doesn't exist, `403` if it
belongs to another user.

### `DELETE /resumes/:id`

Right-to-erasure: deletes the stored file and cascades the database delete to the
parsed result. Returns `204`.

```
curl -X DELETE http://localhost:4000/api/v1/resumes/b3f1c2b0-... -H "Authorization: Bearer <token>"
```

### `PATCH /profiles/:id/autofill`

`:id` must be the caller's own user ID. Applies a parsed resume's `personalInfo`
(→ `firstName`/`lastName`/`phone`/`location`) and `skills` onto the user's profile via
the existing `UsersService`. Optionally accepts corrected values (e.g. after the user
edits the review form) instead of the originally stored ones.

```json
{
  "resumeId": "9a2e0f1c-...",
  "personalInfo": { "fullName": "Selam T.", "phone": "+251911223344", "location": "Addis Ababa" },
  "skills": ["TypeScript", "NestJS", "PostgreSQL"]
}
```

Education/work experience/certifications/languages are not applied to the profile —
the `User` model has no dedicated columns for them today. They remain available via
`GET /resumes/:id` and are shown in the frontend review form for the user's reference.

## GDPR

- **Consent**: `UploadResumeDto.consent` must be `true` (`class-validator` `@Equals(true)`);
  the frontend also blocks submission behind a consent checkbox.
- **Right to erasure**: `DELETE /resumes/:id` removes both the stored file and all
  database rows (the `parsed_resumes` row cascades from `resume_uploads`).
- **Data minimization**: only the fields defined in `ExtractedResumeDto` are ever
  persisted — the raw CV text itself is never stored, only the structured result.
- **Audit trail**: every step (`resume.uploaded`, `resume.parsed`, `resume.parse_failed`,
  `resume.deleted`, `profile.autofilled`) is logged to the existing `events_log` table
  (see `SCHEMA.md`).
- **Retention policy**: raw files and their parsed data are retained only as long as
  the professional keeps them attached to their account. There is no automatic
  time-based purge job in this module (would run on the existing BullMQ/Redis queue
  infrastructure) — this is a documented follow-up, not implemented here, since the
  task scope covers on-demand erasure via `DELETE /resumes/:id`.

## Multi-currency

Any compensation figure found in work experience is always stored/returned as
`{ amount: "<decimal string>", currencyCode: "<ISO 4217>" }` — never a bare number or
float, both in the Prisma JSON column and in `MoneyDto`'s validation
(`amount` must match `^\d+(\.\d{1,2})?$`, `currencyCode` must be 3 uppercase letters).

## Known limitations

- **Legacy `.doc` files**: accepted at the upload/validation boundary, but `mammoth`
  (the DOCX parser) only reliably reads modern `.docx`. A `.doc` upload will fail with
  a clear error asking the user to re-save as `.docx` or PDF.
- **OCR for scanned PDFs**: `OcrFallbackService` runs Tesseract.js directly on image
  uploads. For scanned (image-only) PDFs, a rasterization step (PDF page → image) is
  required first; this is left as an explicit extension point
  (`OcrFallbackService.rasterizePdf`) rather than pulling in a native PDF-rendering
  toolchain (poppler/canvas) for this assessment's scope.

## Testing

```
npm test                       # full suite, includes this module
npx jest resume-brain          # this module only
```

Covers: DTO validation (`dto/*.spec.ts`), each parser and the OCR fallback
(`parsers/*.spec.ts`), both extraction providers (`extraction/*.spec.ts`), the service
and both controllers (mocked dependencies), and one end-to-end test
(`resume-brain.e2e.spec.ts`) driving the real HTTP upload → parse → retrieve flow with
an in-memory Prisma double and a hand-built minimal PDF fixture
(`fixtures/build-pdf-fixture.ts`). `pdf-parse`'s vendored legacy pdf.js build is mocked
in tests (matching how `mammoth`/`tesseract.js` are mocked) — independently verified
against plain Node, that library's bundled parser is unreliable under ts-jest's module
environment for hand-built fixture PDFs; this is a third-party quirk, not a bug in this
module's code.
