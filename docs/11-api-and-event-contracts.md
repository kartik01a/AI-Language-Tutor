# 11 — API & Event Contracts

> Related: [09 Architecture](09-system-architecture.md) · [07 State machine](07-conversation-state-machine.md) · [06 Tutor behaviour §5](06-ai-tutor-behavior.md) · [10 Data model](10-database-and-data-model.md)

All endpoints are Next.js route handlers under `/api`, authenticated with the Supabase session cookie (JWT). Request/response bodies are validated with Zod; the TypeScript types below are the source of truth (`lib/contracts.ts`), shared by client and server.

Conventions: JSON unless stated; times in ISO-8601 UTC; ids are UUIDs; errors use the envelope in §6.

---

## 1. Endpoints

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/onboarding` | Save onboarding answers (per step) | Idempotent upsert of `learner_languages` |
| `POST /api/consent` | Record adult confirmation, privacy notice acceptance, audio opt-in, analytics opt-in | Writes `consent_events` |
| `POST /api/sessions` | Create a session | Checks consent, limits, budget → returns greeting |
| `POST /api/sessions/{id}/turns` | Upload a learner turn; **streamed frame response** | Hot path (§3) |
| `POST /api/sessions/{id}/events` | Client events (topic chip, hint request, silence timeout, interrupt, pause/resume, card try-again, correction report) | Some return a streamed tutor response (hint nudge) |
| `POST /api/sessions/{id}/resume` | Reconnect after drop; returns missed frames | Within `RECONNECT_WINDOW_SECONDS` |
| `POST /api/sessions/{id}/end` | End early (user) | Triggers end-of-session analysis |
| `GET /api/sessions/{id}/summary` | Poll summary (until `status: ready`) | |
| `GET /api/me/dashboard` | Dashboard aggregate | Server component may call the same function directly |
| `GET /api/me/history?cursor=` | Past sessions | |
| `DELETE /api/me/sessions/{id}` · `DELETE /api/me/history` | Delete one / all sessions | |
| `PATCH /api/me/vocabulary/{id}` | Save/unsave word | |
| `PATCH /api/me/settings` | Strictness, display, sound, reduced motion, audio opt-in | |
| `POST /api/waitlist` | Join waitlist + price answer | |
| `DELETE /api/account` · `GET /api/account/export` | Erasure / data export | |
| `GET /api/admin/*` | Admin aggregates and CSV | `ADMIN_EMAILS` only |
| `POST /api/cron/{job}` | Scheduler jobs (audio purge, erasure, keep-alive, backups) | Auth via OIDC token from Cloud Scheduler |

---

## 2. Session creation

```ts
// POST /api/sessions
type CreateSessionRequest = {
  learnerLanguageId: string;
  topic?: { chipId: string } | { surprise: true };     // optional preselected topic from dashboard
};

type CreateSessionResponse = {
  sessionId: string;
  tutor: { id: string; name: string; avatarUrl: string; accent: string };
  level: 'A1' | 'A2' | 'B1' | 'B2';
  limits: { sessionTargetSeconds: number; trialRemainingSeconds: number | null };
  display: { furigana: boolean; romaji: boolean; translationDefault: boolean };
  greeting: TutorMessage;                               // template audio URL(s) + text
  topicChips: { id: string; label: string; tag?: string }[];
  stateVersion: number;
};
```

Errors: `CONSENT_REQUIRED`, `ONBOARDING_INCOMPLETE`, `TRIAL_EXHAUSTED`, `BUDGET_PAUSED`, `RATE_LIMITED`.

---

## 3. Turn upload & streamed frames

### 3.1 Request

`POST /api/sessions/{id}/turns` — `multipart/form-data`:

| Part | Type | Notes |
|---|---|---|
| `audio` | `audio/webm;codecs=opus` or `audio/mp4` | ≤ 2 MB, ≤ 30 s |
| `meta` | JSON | below |

```ts
type TurnMeta = {
  turnSeq: number;                  // client-incremented; server rejects gaps/duplicates
  idempotencyKey: string;           // uuid; retries reuse it
  stateVersion: number;             // optimistic concurrency
  clientVad: { speechMs: number; clipMs: number; rmsDb: number };
  context: 'conversation' | 'card_retry' | 'repeat_phrase';
  cardId?: string;                  // when context = card_retry
  recordedAt: string;
};
```

### 3.2 Response framing

`Content-Type: application/octet-stream`. The body is a sequence of frames:

```
┌────────┬──────────────┬───────────────┐
│ type:1 │ length:4 (BE)│ payload:length│
└────────┴──────────────┴───────────────┘
type 0x01 = JSON event (UTF-8)     type 0x02 = audio chunk (MP3 bytes for the preceding `sentence` event)
```

Every JSON event carries `seq` (monotonic per session) so `/resume` can replay from the last acknowledged `seq`.

### 3.3 Event types (server → client)

```ts
type ServerEvent =
  | { t: 'transcript'; seq: number; turnId: string; text: string | null;
      display: 'normal' | 'unclear';                 // unclear → "(I couldn't catch this)" + Show what I heard
      ruby?: RubyToken[]; lowConfidenceSpans?: [number, number][] }
  | { t: 'category'; seq: number; category: TurnCategory; action: PolicyAction }   // drives avatar expression
  | { t: 'sentence'; seq: number; messageId: string; index: number;
      text: string; ruby?: RubyToken[]; translation?: string;
      role: 'recast' | 'content' | 'question' | 'template';
      audio: { format: 'mp3'; bytes: number; durationMs: number };
      visemes: { t: number; v: VisemeId }[];
      recastOf?: { cardId?: string } }                // link underline → card (only if card survives gating)
  | { t: 'suggestion'; seq: number; kind: 'you_can_say' | 'teach_phrase';
      options: { text: string; ruby?: RubyToken[]; translation: string; audioUrl?: string }[] }
  | { t: 'corrections'; seq: number; turnId: string; cards: CorrectionCard[] }  // async, may arrive after turn_end
  | { t: 'hints'; seq: number; forMessageId: string; hint: string; starter: string; example: string; exampleTranslation: string }
  | { t: 'goal'; seq: number; goalId: string; achieved: true; label: string }
  | { t: 'limits'; seq: number; activeSeconds: number; trialRemainingSeconds: number | null; wrapUp: boolean; reason?: WrapUpReason }
  | { t: 'turn_end'; seq: number; stateVersion: number; expect: 'learner' | 'end' }
  | { t: 'session_end'; seq: number; reason: EndReason; summaryUrl: string }
  | { t: 'error'; seq: number; code: ErrorCode; retryable: boolean; message: string };

type RubyToken = { s: string; r?: string; ro?: string };   // surface, reading (kana), romaji

type CorrectionCard = {
  id: string;
  card: 'fix' | 'alternative' | 'praise';
  errorCode: string;                       // taxonomy code
  original: string; corrected: string;     // corrected hidden until "Show answer" when tryAgainFirst
  span: [number, number];                  // in the learner transcript
  explanation: string;                     // ≤ 15-word rule
  more?: string;                           // "Why?" expansion
  tryAgainFirst: boolean;                  // strictness-dependent
  audioUrl?: string;                       // "Hear it" (synthesised on demand, cached)
};
```

### 3.4 Ordering guarantees

1. `transcript` always first (within ~1 s of upload completion).
2. `category` before the first `sentence`.
3. `sentence` frames in index order, each immediately followed by its audio frame.
4. `hints` after the last `sentence`.
5. `corrections` may arrive before or after `turn_end`; the client attaches cards to `turnId`.
6. `turn_end` closes the turn; the stream closes after any pending `corrections` or a 5 s grace.

---

## 4. Client events

```ts
// POST /api/sessions/{id}/events
type ClientEvent =
  | { e: 'topic_chip'; chipId: string }
  | { e: 'hint_request'; forMessageId: string }                // returns { level, content } (no LLM call — uses cached hints)
  | { e: 'silence_timeout'; forMessageId: string; silentMs: number }   // returns streamed nudge (template audio)
  | { e: 'interrupted'; messageId: string; playedMs: number }
  | { e: 'pause' } | { e: 'resume' }                            // backgrounded / idle pause (active-time accounting)
  | { e: 'card_report'; cardId: string; reason: 'was_correct' | 'misheard' | 'other'; note?: string }
  | { e: 'translation_tap'; messageId: string }                 // comprehension signal
  | { e: 'replay'; messageId: string; slow: boolean };          // comprehension signal (no server work)
```

Card "Try again" uploads audio via the turns endpoint with `context: 'card_retry'`; the response contains `transcript` + a `card_result` event:

```ts
| { t: 'card_result'; seq: number; cardId: string; result: 'fixed' | 'not_yet' | 'unclear' }
```

---

## 5. Internal LLM contracts

Defined as JSON Schemas generated from Zod (`lib/tutor/schemas.ts`), versioned with the prompt (`turn@7`):

| Schema | Producer | Defined in |
|---|---|---|
| `TurnOutput` (analysis → reply → hints → words) | turn call | [06 §5.2](06-ai-tutor-behavior.md) |
| `EditCandidates` `{ edits: [{ code, original, corrected, span, type: 'grammar'|'vocab'|'style' }] }` | correction detection ×3 | 06 §6 |
| `Explanations` `{ items: [{ editId, rule, example }] }` | explanation call | 06 §6 |
| `SessionSummary` `{ didWell[], fixes[], newWords[], nextFocus, verified: [{ cardId, agree }], canDo: { level, rationale } }` | end-of-session | [08 §4](08-language-learning-engine.md) |

Provider adapters translate these to OpenAI `text.format: json_schema (strict)` or the Anthropic equivalent. Schemas avoid provider-specific features so failover is a config switch.

---

## 6. Errors

```ts
type ErrorEnvelope = { error: { code: ErrorCode; message: string; retryable: boolean; details?: unknown } };

type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'CONSENT_REQUIRED' | 'ONBOARDING_INCOMPLETE'
  | 'TRIAL_EXHAUSTED' | 'BUDGET_PAUSED' | 'RATE_LIMITED'
  | 'SESSION_NOT_FOUND' | 'SESSION_ENDED' | 'STATE_CONFLICT'      // 409 → client resyncs via /resume
  | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_AUDIO'
  | 'PROVIDER_STT' | 'PROVIDER_LLM' | 'PROVIDER_TTS' | 'INTERNAL';
```

| HTTP | Codes |
|---|---|
| 401 | UNAUTHENTICATED |
| 403 | FORBIDDEN, CONSENT_REQUIRED |
| 402 | TRIAL_EXHAUSTED (client → waitlist) |
| 409 | STATE_CONFLICT, SESSION_ENDED |
| 413 / 415 | PAYLOAD_TOO_LARGE / UNSUPPORTED_AUDIO |
| 429 | RATE_LIMITED (`Retry-After`) |
| 503 | BUDGET_PAUSED (client → "practice paused" screen) |
| 200 + `error` frame | provider errors inside a stream (`retryable: true` → template "hiccup" line already played) |

---

## 7. Versioning

- Contracts carry `X-Contract-Version: 1` header; the client refuses to start a session against an incompatible server (forces reload — PWA update flow).
- Prompt/schema versions, tutor config versions and provider model ids are recorded per session (`sessions.config_versions`) — never inferred later.
