# Spur Chat — AI Support Agent

A full-stack AI customer support chat widget built for the Spur founding engineer assignment.

**Live demo:** https://spur-chat-eight.vercel.app

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally or via a hosted service)
- A Groq API key (free at [console.groq.com](https://console.groq.com))

---

## 1. Clone & Install

```bash
git clone https://github.com/SameerKumar2609/spur-chat.git
cd spur-chat

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

---

## 2. Configure Environment Variables

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
# Required
GROQ_API_KEY=gsk_...your key...

# Database — pick one option:
# Option A: connection string
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5433/spur_chat

# Option B: individual fields (used if DATABASE_URL is not set)
DB_HOST=localhost
DB_PORT=3001
DB_NAME=spur_chat
DB_USER=postgres
DB_PASSWORD=yourpassword

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:3001
```

---

## 3. Set Up the Database

```bash
# Create the database (if it doesn't exist)
createdb spur_chat

# Run migrations
cd backend
npm run db:migrate

# (Optional) Seed with a sample conversation
npm run db:seed
```

The migration creates two tables: `conversations` and `messages`. See [Schema](#schema) below.

---

## 4. Run the App

In two separate terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → Server on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → App on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 5. Build for Production

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build && npm run preview
```

---

## Architecture Overview

```
spur-chat/
├── backend/
│   └── src/
│       ├── index.ts              # Express entry point, middleware wiring
│       ├── routes/
│       │   └── chat.routes.ts    # Route definitions + dependency wiring
│       ├── controllers/
│       │   └── chat.controller.ts # Request validation (Zod), response shaping
│       ├── services/
│       │   ├── chat.service.ts   # Orchestration: session logic, message flow
│       │   └── llm.service.ts    # Anthropic API encapsulation
│       ├── repositories/
│       │   └── conversation.repository.ts  # All DB queries (single responsibility)
│       ├── middleware/
│       │   └── errorHandler.ts   # Centralised error → HTTP response mapping
│       ├── types/
│       │   └── index.ts          # Shared TypeScript interfaces
│       └── db/
│           ├── pool.ts           # pg Pool singleton
│           ├── migrate.ts        # Idempotent schema migrations
│           └── seed.ts           # Sample data seeder
└── frontend/
    └── src/
        ├── routes/
        │   └── +page.svelte      # Single-page chat UI
        ├── lib/
        │   ├── api.ts            # fetch wrappers for the backend
        │   └── chatStore.ts      # Svelte store for UI state
        └── app.css               # Design tokens + global styles
```

### Layered Backend Design

```
HTTP Request
    ↓
Route (chat.routes.ts)          ← URL mapping + DI wiring
    ↓
Controller (chat.controller.ts) ← Zod validation, HTTP concerns only
    ↓
Service (chat.service.ts)       ← Business logic, orchestration
    ↓
Repository (conversation.repo)  ← DB queries, no business logic
LLMService (llm.service.ts)     ← Groq API, prompt assembly
    ↓
PostgreSQL / Groq API
```

Each layer has one job. Adding a WhatsApp channel means adding a new route + controller; the service and repository stay untouched.

---

## API Endpoints

### `POST /chat/message`

**Request:**
```json
{
  "message": "What's your return policy?",
  "sessionId": "optional-uuid-for-existing-conversation"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day return policy...",
  "sessionId": "uuid-of-conversation",
  "messageId": "uuid-of-the-ai-message"
}
```

- If `sessionId` is omitted or unknown, a new conversation is created.
- Messages longer than 2000 characters are rejected with a 400.

### `GET /chat/history/:sessionId`

Returns the full message history for a conversation. Used on page reload to restore context.

### `GET /health`

Returns `{ status: "ok", timestamp: "..." }`. Useful for deployment health checks.

---

## Schema

```sql
conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
)

messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender           VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
  text             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

`metadata` on conversations is intentionally a JSONB blob — it can carry channel info (`source: 'whatsapp'`), user agent data, or merchant ID without schema changes.

---


## LLM Notes

**Provider:** Groq (`llama-3.3-70b-versatile`) — free tier, very fast inference

**Prompting strategy:**

1. **System prompt** — Contains the store's FAQ (shipping policy, returns, support hours, payment methods) as structured plain text. Hardcoded for simplicity; in production it would be fetched from a `store_config` table per-merchant.

2. **Conversation history** — The last 10 messages are included in each API call for contextual replies. Capped to control token cost.

3. **Max tokens** — Set to 512 per response. Support answers should be concise; this also limits cost.

**Error handling:**
- `401` → authentication failure surfaced as "check your API key"
- `429` → rate limit surfaced as "try again in a moment"
- `5xx` → generic "service temporarily unavailable"
- Network timeout → "AI took too long to respond"

All LLM errors return friendly user-facing messages; the raw error is logged server-side.
---

## Robustness

- **Empty messages** — rejected at the Zod validation layer (400)
- **Oversized messages** — truncated server-side at 2000 chars; frontend also warns and blocks send
- **Unknown sessionId** — silently creates a new conversation instead of crashing
- **LLM failure** — caught, logged, friendly error shown in chat UI
- **DB connection failure** — process exits with error at startup (fail fast)
- **Rate limiting** — 60 req/min per IP on all `/chat` routes
- **No secrets in repo** — `.env` in `.gitignore`, only `.env.example` committed
- **Input size limit** — `express.json({ limit: '50kb' })` prevents payload attacks

---

## Trade-offs & If I Had More Time

**Decisions made for speed:**
- **FAQ in system prompt** — Dead simple and reliable. A DB-backed `knowledge_base` table with per-merchant rows would be the right production approach, enabling dynamic updates without redeploys.
- **No auth** — As per spec. In production: JWT sessions or clerk.dev for multi-tenant merchant auth.
- **Single-file migration runner** — Works fine for this scope. Would use a proper migration tool (e.g. `node-pg-migrate`) for production.
- **No Redis** — Session state is just a UUID in localStorage; no server-side session needed. Redis would be useful for caching recent history or rate-limit state across multiple server instances.

**Things I'd add with more time:**
- **Streaming responses** — Anthropic supports SSE streaming; piping it to the frontend would make the typing experience feel much more natural.
- **Tool use / function calling** — Real order lookup, shipping status, etc. by giving the LLM DB access via tools.
- **Multi-tenant** — `store_id` on conversations, per-store system prompts, merchant dashboard.
- **Message reactions / feedback** — Thumbs up/down on AI replies to collect fine-tuning data.
- **End-to-end tests** — Playwright for the UI flow, supertest for the API.
- **Docker Compose** — `docker-compose up` to spin up Postgres + backend + frontend in one command.
