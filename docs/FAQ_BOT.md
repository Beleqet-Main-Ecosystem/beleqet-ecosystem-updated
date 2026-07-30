# Beleqet FAQ Bot — Technical Documentation

**Author:** Henok Tilahun  
**Branch:** `feat/faq-bot-henok-tilahun`  
**Module:** User Experience & UI — AI-powered FAQ Bot  
**Assessment:** Beleqet Technical Assessment — Round 2

---

## 1. Executive Summary

The FAQ Bot is an AI-powered support assistant for the Beleqet freelance and jobs platform. It lets users get **instant answers** to common questions about wallets, escrow, job applications, freelance bidding, fees, and account security — without waiting for human support.

The module is implemented as a **self-contained NestJS feature** (`FaqBotModule`) plus a **Next.js floating chat widget** (`frontend/`). It meets Beleqet's global scaling requirements: **i18n**, **GDPR**, and **multi-currency** support, with **Jest unit tests** for all core services.

---

## 2. What the FAQ Bot Can Do

| Capability | Description |
|------------|-------------|
| **Instant FAQ answers** | Responds to platform questions using a seeded knowledge base |
| **Keyword / intent matching** | Fast NLP-lite routing (e.g. "withdraw" → wallet FAQ) |
| **Semantic search** | Vector similarity over FAQ embeddings (when OpenAI key is set) |
| **AI-generated answers** | OpenAI streaming RAG for complex or unmatched questions |
| **Real-time streaming** | Token-by-token replies via WebSocket (`/faq-bot`) |
| **REST fallback** | Non-streaming HTTP endpoint when WebSocket is unavailable |
| **GDPR compliance** | Consent required, session export, right to erasure, 90-day retention |
| **Internationalization** | English and Amharic UI + localized FAQ content |
| **Multi-currency** | Formats payment answers in ETB, USD, or EUR |
| **Async AI webhook** | HMAC-verified callback endpoint for external AI jobs |

---

## 3. Purpose & Use Cases

### Primary purpose
Improve **User Experience (UX)** by reducing support load and giving users immediate, accurate answers while browsing Beleqet.

### Example user questions the bot handles

| User question | How it is handled |
|---------------|-------------------|
| "How do I withdraw from my wallet?" | Keyword match → `wallet-withdrawal` FAQ (fast path) |
| "How does BeleqetSafe escrow work?" | Keyword match → `escrow-overview` FAQ |
| "How do I apply for a job?" | Keyword match → `job-application` FAQ |
| "What currencies do you support?" | Keyword match → `multi-currency` FAQ + currency formatting |
| "When can I access my freelance earnings?" | Semantic search + AI synthesis (with OpenAI key) |
| "Is there a new job available?" | Requires OpenAI key or additional KB seeding for live job data |

### Who benefits

- **Job seekers** — application process, account security  
- **Freelancers** — wallet withdrawals, bidding, milestones  
- **Employers / clients** — escrow funding, platform fees  
- **Support team** — fewer repetitive tickets  
- **Platform** — scalable self-service support globally  

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js) — frontend/                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FaqBotWidget (floating bubble, bottom-right)            │   │
│  │  • GDPR consent modal                                     │   │
│  │  • Language (en/am) + Currency (ETB/USD/EUR) selectors   │   │
│  │  • useFaqBotStream hook → Socket.io + REST fallback       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (NestJS) — src/modules/faq-bot/                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ FaqBot      │  │ FaqBot       │  │ FaqBotService          │  │
│  │ Controller  │  │ Gateway      │  │ (orchestrator)         │  │
│  │ REST + SSE  │  │ /faq-bot WS  │  └───────────┬────────────┘  │
│  └─────────────┘  └──────────────┘              │               │
│                                                  ▼               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ QueryClassifier → KnowledgeRetrieval → AiStreamService      │ │
│  │ FaqBotConsentService │ FaqBotCurrencyService                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Docker)                                          │
│  • faq_knowledge_entries  — FAQ content + embeddings (JSON)   │
│  • faq_bot_sessions       — locale, currency, GDPR consent      │
│  • faq_bot_messages       — chat history + source tracking      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Answer Pipeline (How a Question Is Processed)

When a user sends a message, `FaqBotService.processQuestion()` runs this pipeline:

```
User question
     │
     ▼
┌────────────────────┐
│ 1. GDPR consent    │  Session must have consentGiven = true
│    check           │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 2. Keyword /       │  QueryClassifierService scores intents
│    intent match    │  (withdraw, escrow, apply, bid, etc.)
└─────────┬──────────┘
          │
    confidence ≥ 0.75?
     │            │
    YES           NO
     │            ▼
     │     ┌────────────────────┐
     │     │ 3. Vector / keyword │  KnowledgeRetrievalService
     │     │    retrieval        │  findSimilar() or findByKeywords()
     │     └─────────┬──────────┘
     │               ▼
     │     ┌────────────────────┐
     │     │ 4. AI streaming    │  AiStreamService (OpenAI RAG)
     │     │    (if key set)    │  Falls back to KB if no key
     │     └─────────┬──────────┘
     │               │
     ▼               ▼
┌────────────────────────────────────┐
│ 5. Stream tokens via WebSocket     │  stream_start → stream_chunk → stream_end
│ 6. Save message + sources to DB    │
└────────────────────────────────────┘
```

### Operating modes

| Mode | When | Behavior |
|------|------|----------|
| **Knowledge Base (fast path)** | Strong keyword match + FAQ slug found | Streams pre-written FAQ answer instantly |
| **Knowledge Base (fallback)** | No OpenAI key or dummy/placeholder key | Uses retrieved FAQ text directly |
| **AI-powered (RAG)** | Valid `OPENAI_API_KEY` + no strong keyword match | Embeds query, retrieves context, streams GPT answer |

---

## 6. Project Structure

```
beleqet-ecosystem-updated/
├── src/modules/faq-bot/
│   ├── faq-bot.module.ts           # NestJS module registration
│   ├── faq-bot.controller.ts       # REST + SSE endpoints
│   ├── faq-bot.gateway.ts          # WebSocket streaming (/faq-bot)
│   ├── faq-bot.service.ts          # Main orchestrator
│   ├── dto/
│   │   ├── create-session.dto.ts
│   │   ├── ask-question.dto.ts
│   │   └── ai-webhook.dto.ts
│   ├── services/
│   │   ├── query-classifier.service.ts    # NLP keyword/intent matching
│   │   ├── knowledge-retrieval.service.ts # Vector + keyword search
│   │   ├── ai-stream.service.ts           # OpenAI streaming RAG
│   │   ├── faq-bot-consent.service.ts     # GDPR compliance
│   │   ├── faq-bot-currency.service.ts    # Multi-currency formatting
│   │   └── openai-config.ts               # Validates API key presence
│   └── *.spec.ts                   # Jest unit tests (5 files)
├── src/i18n/
│   ├── en/faq-bot.json
│   └── am/faq-bot.json
├── prisma/
│   ├── schema.prisma               # FaqKnowledgeEntry, FaqBotSession, FaqBotMessage
│   ├── faq-seed-data.ts            # 8 seeded FAQ entries
│   └── migrations/20260705100000_faq_bot/
├── frontend/
│   ├── app/page.tsx                # Demo page
│   ├── components/FaqBotWidget.tsx # Floating chat UI
│   └── lib/useFaqBotStream.ts      # WebSocket + REST hook
└── docs/FAQ_BOT.md                 # This document
```

---

## 7. Global Scaling Requirements

### 7.1 Internationalization (i18n)

- **Backend:** `nestjs-i18n` with `src/i18n/en/faq-bot.json` and `src/i18n/am/faq-bot.json`
- **FAQ content:** Each entry has `questionEn` / `answerEn` and optional `questionAm` / `answerAm`
- **Session locale:** Stored on `FaqBotSession.locale` (`en` | `am`)
- **Frontend:** Language selector in the chat widget; strings in `frontend/lib/translations.ts`

### 7.2 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Consent before chat** | `consentGiven` must be `true` on session create |
| **Data retention** | Sessions expire after `FAQ_BOT_RETENTION_DAYS` (default 90) |
| **Right to access** | `GET /api/v1/faq-bot/sessions/:id/export` |
| **Right to erasure** | `DELETE /api/v1/faq-bot/sessions/:id` |
| **Minimal PII** | Anonymous `anonymousId` in localStorage; no email unless logged in |

### 7.3 Multi-Currency

- Session stores `preferredCurrency` (`ETB` | `USD` | `EUR`)
- `FaqBotCurrencyService` reuses `WalletService.convertCurrency()` for exchange rates
- FAQ answers use placeholders `{{MIN_WITHDRAWAL}}` and `{{ESCROW_FEE}}` replaced at runtime
- Amounts formatted with `Intl.NumberFormat` for the user's locale and currency

---

## 8. API Reference

**Base URL:** `http://localhost:4000/api/v1`  
**Swagger:** `http://localhost:4000/api/docs` (tag: `faq-bot`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/faq-bot/sessions` | Create session (requires GDPR consent) |
| `GET` | `/faq-bot/sessions/:id/messages` | Get chat history |
| `POST` | `/faq-bot/sessions/ask` | Ask question (REST, non-streaming) |
| `GET` | `/faq-bot/sessions/:id/stream?message=...` | Ask via Server-Sent Events |
| `POST` | `/faq-bot/webhook/ai` | Async AI callback (HMAC signature optional) |
| `GET` | `/faq-bot/sessions/:id/export` | GDPR data export |
| `DELETE` | `/faq-bot/sessions/:id` | GDPR session deletion |

### WebSocket (Socket.io)

- **URL:** `http://localhost:4000/faq-bot`
- **Emit:** `ask` → `{ sessionId, message }`
- **Listen:**
  - `stream_start` — response beginning
  - `stream_chunk` → `{ token }` — partial text
  - `stream_end` → `{ messageId, content, sources, usedAi }` — complete response
  - `error` → `{ message }` — failure

### Example: Create session

```json
POST /api/v1/faq-bot/sessions
{
  "locale": "en",
  "preferredCurrency": "ETB",
  "consentGiven": true,
  "anonymousId": "anon-abc12345"
}
```

### Example: Ask (REST)

```json
POST /api/v1/faq-bot/sessions/ask
{
  "sessionId": "uuid-here",
  "message": "How do I withdraw from my wallet?"
}
```

---

## 9. Database Models

### FaqKnowledgeEntry
Stores FAQ articles with optional vector embeddings (JSON float array).

| Field | Purpose |
|-------|---------|
| `slug` | Unique identifier (e.g. `wallet-withdrawal`) |
| `category` | wallet, escrow, jobs, freelance, fees, support |
| `questionEn` / `answerEn` | English content |
| `questionAm` / `answerAm` | Amharic content (optional) |
| `keywords` | Keyword array for fast matching |
| `embedding` | OpenAI embedding vector (JSON) for semantic search |
| `currency` | Related currency context |

### FaqBotSession
| Field | Purpose |
|-------|---------|
| `locale` | `en` or `am` |
| `preferredCurrency` | `ETB`, `USD`, or `EUR` |
| `consentGiven` / `consentAt` | GDPR consent record |
| `expiresAt` | Auto-expiry for retention policy |

### FaqBotMessage
| Field | Purpose |
|-------|---------|
| `role` | `USER`, `ASSISTANT`, or `SYSTEM` |
| `content` | Message text |
| `sources` | JSON array of FAQ slugs used for the answer |

---

## 10. Seeded Knowledge Base

Eight FAQ entries are seeded via `prisma/faq-seed-data.ts` and `npm run prisma:seed`:

| Slug | Topic |
|------|-------|
| `wallet-withdrawal` | How to withdraw from freelancer wallet |
| `escrow-overview` | BeleqetSafe escrow process |
| `job-application` | Applying for jobs |
| `freelance-bidding` | Bidding on freelance projects |
| `account-security` | Account safety |
| `platform-fees` | Platform and escrow fees |
| `multi-currency` | Supported currencies |
| `contact-support` | Contacting human support |

Embeddings are generated automatically during seed when a valid `OPENAI_API_KEY` is set.

---

## 11. Environment Variables

Add to `.env`:

```env
# Database (local dev connecting to Docker Postgres on port 5433)
DATABASE_URL=postgresql://beleqet_user:your_password@localhost:5433/beleqet_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (optional — enables full AI + embeddings)
OPENAI_API_KEY=sk-your-real-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# FAQ Bot
FAQ_BOT_WEBHOOK_SECRET=your_hmac_secret
FAQ_BOT_RETENTION_DAYS=90
```

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

> **Note:** Placeholder keys (`sk-...`, `dummy_*`) are treated as "no AI" — the bot uses the knowledge base only.

---

## 12. How to Run

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### Step 1 — Start infrastructure

```powershell
cd "H:\Job Interviews\beleqet-ecosystem-updated"
docker compose up -d db redis
```

### Step 2 — Database setup (first time only)

```powershell
npx prisma migrate deploy
npm run prisma:seed
```

### Step 3 — Start backend

**Option A — Local (recommended for development):**

```powershell
npm run start:dev
```

**Option B — Docker:**

```powershell
docker compose build backend
docker compose up -d --no-deps backend
```

> Do **not** run both at the same time — they both use port **4000**.

### Step 4 — Start frontend

```powershell
cd frontend
npm install
npm run dev
```

### Step 5 — Test

1. Open **http://localhost:3000**
2. Click the **chat bubble** (bottom-right)
3. Accept **GDPR consent**
4. Ask: *"How do I withdraw from my wallet?"*
5. Verify streaming reply appears

**API docs:** http://localhost:4000/api/docs

---

## 13. Running Terminals — What Should Stay Open?

| Terminal | Command | Keep running? |
|----------|---------|---------------|
| Docker Desktop | App running | Yes (for Postgres + Redis) |
| Frontend | `npm run dev` | Yes (for UI at :3000) |
| Backend (local) | `npm run start:dev` | Yes, **OR** use Docker backend |
| Backend (Docker) | `docker compose up -d backend` | Runs in background — no terminal needed |
| `docker compose build` | One-time build | Exits when done — safe to close |

If a terminal shows a completed build command with no active process, you can close it. Only keep terminals that are actively serving the app.

---

## 14. Unit Tests

Run all tests:

```powershell
npm test
```

FAQ Bot specific tests:

```powershell
npm test -- --testPathPattern=faq-bot
```

| Test file | Covers |
|-----------|--------|
| `query-classifier.service.spec.ts` | Keyword/intent classification |
| `knowledge-retrieval.service.spec.ts` | Cosine similarity, keyword search |
| `faq-bot-consent.service.spec.ts` | GDPR consent, export, delete |
| `ai-stream.service.spec.ts` | Fallback streaming without OpenAI |
| `faq-bot.service.spec.ts` | Session creation, consent validation |

---

## 15. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Can't reach database at localhost:5433` | Postgres container not running | `docker start beleqet-postgres` |
| `EADDRINUSE :4000` | Two backends fighting for port 4000 | Stop one: `docker stop beleqet-backend` OR kill local `npm` process |
| `Cannot GET /api/v1` in browser | No route at API root | Use `/api/docs` or the frontend widget |
| Bot shows no reply | Dummy OpenAI key + UI bug (fixed) | Rebuild backend; hard-refresh browser |
| `Conflict: container name already in use` | Old containers exist | `docker start <name>` or `docker rm <name>` then recreate |
| FAQ answers wrong language | Locale not set | Select language in widget before starting chat |
| Authentication failed for DB | Wrong `DATABASE_URL` | Use `beleqet_user:your_password@localhost:5433` |

---

## 16. Submission Checklist (PR)

- [ ] Branch: `feat/faq-bot-henok-tilahun`
- [ ] Only `FaqBotModule` + `frontend/` FAQ widget changed (no unrelated refactors)
- [ ] i18n files present (`en` + `am`)
- [ ] GDPR endpoints working (export, delete, consent)
- [ ] Multi-currency formatting in wallet/fees answers
- [ ] Unit tests pass (`npm test`)
- [ ] TSDoc comments on public methods
- [ ] Demo works: frontend widget + backend API
- [ ] Open PR to Beleqet main repository

```powershell
git add .
git commit -m "feat: add AI-powered FAQ Bot with streaming, i18n, GDPR, and multi-currency"
git push -u origin feat/faq-bot-henok-tilahun
gh pr create --title "feat: FAQ Bot module (Round 2)" --body "..."
```

---

## 17. Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate `/faq-bot` WebSocket namespace** | Keeps support bot isolated from contract chat (`/chat`) |
| **Hybrid keyword + vector + AI** | Fast deterministic answers for common questions; AI for edge cases |
| **JSON embeddings in PostgreSQL** | No extra vector DB infra; portable and sufficient for assessment scale |
| **Docker for db/redis, flexible backend** | Standard NestJS dev workflow with Dockerized data layer |
| **Next.js sibling `frontend/` package** | Repo had no frontend; widget demo required for assessment |
| **Placeholder API key detection** | Prevents dummy Docker keys from breaking KB fallback path |

---

## 18. Future Enhancements (Out of Scope)

- Live job listings integration ("new jobs available")
- Admin UI to manage FAQ knowledge base
- pgvector native extension for faster similarity search at scale
- User-authenticated sessions linked to `User.id`
- Analytics dashboard for common unanswered questions

---

*Document version: 1.0 — July 2026*
