# 01 — Product Requirements

> Status: **Approved** (discovery completed and confirmed 2026-10-14).
> Related: [README](README.md) · [User journeys & UX](02-user-journeys-and-ux.md) · [Tutor behaviour](06-ai-tutor-behavior.md) · [Roadmap](16-implementation-roadmap.md) · [Risks & open decisions](17-risks-and-open-decisions.md)

This document is the single source of truth for **what** we are building and **why**. Every other document refers back to the decision IDs (`D-xx`), functional requirements (`FR-xx`) and non-functional requirements (`NFR-xx`) defined here.

---

## 1. Product summary

A mobile-first web app where Indian adult learners practise speaking **Japanese**, **German** or **English** by holding short spoken conversations with a cartoon tutor character. Each language has one tutor with its own fixed native voice and personality. The tutor:

- opens the conversation and asks what the learner wants to talk about,
- adapts its language to the learner's level,
- helps when the learner is stuck (escalating hints),
- corrects mistakes **only when it is confident they are real mistakes**,
- never pretends to understand speech it did not understand,
- ends with a summary of corrections, new words and strengths, which feed the learner's progress record.

### 1.1 Problem

Indian adults learning Japanese (JLPT, work in Japan), German (study/work migration) or English (career) rarely have an affordable, patient speaking partner. Existing AI tutors are attractive but are known for two trust-damaging behaviours: they **pretend to understand** unclear speech, and they **over-correct** — flagging things that were fine or that the speech recogniser misheard.

### 1.2 Differentiators (D-09)

1. **Trustworthy corrections** — measurably low false-correction rate; explicit uncertainty handling; the tutor asks rather than guesses.
2. **Memorable characters** — one tutor per language with stable voice, accent, personality and teaching style across every session.

Everything else (gamification, breadth of features) is deliberately secondary.

### 1.3 Project framing

Portfolio/learning project that may become commercial (D-05). Built by **one developer**, no fixed timeline. Budget **≈ $50 / month** for AI + infrastructure (D-06); a voice-provider subscription may be added outside that budget if the voice evaluation justifies it (D-41).

---

## 2. Target users

| Attribute | Decision |
|---|---|
| Age | **Adults 18+ only** (D-01). Enforced by a neutral date-of-birth age gate at sign-up; only an "18+ confirmed" flag is stored (India's DPDP Act treats under-18s as children requiring verifiable parental consent — see [14-security-and-privacy](14-security-and-privacy.md)). |
| Market | **India** (D-08). Price-sensitive, mobile-first, variable 4G networks, mid-range Android phones dominate; a minority on iPhone. |
| Expected volume | 500–1,000 users in the first 3–6 months (D-08). |
| Native language | Collected at onboarding and stored (D-02). **Not used to change explanation language in the MVP** (D-12). |
| Target languages & levels | Japanese A1–B2, German A1–B2, English **A2–B2** (D-04, D-22). |
| Motivations | Collected at onboarding (travel, career/relocation, exams, study, hobby/culture). Used to suggest topics and tune the tutor's vocabulary. |

### 2.1 Personas (illustrative)

- **Priya, 24, Pune — Japanese A2.** Passed JLPT N5, preparing for a job at a Japanese IT firm. Can read hiragana/katakana and some kanji, freezes when speaking. Wants daily 5-minute practice on her commute.
- **Arjun, 29, Bengaluru — German A1.** Planning a Master's in Germany. Knows basic phrases from an app. Needs help forming sentences at all; benefits most from hints and sentence starters.
- **Meena, 35, Lucknow — English A2/B1.** Hindi-dominant; wants confidence for interviews and office conversations. Needs Hindi translations of tutor messages and gentle corrections.

---

## 3. Scope

### 3.1 In scope for the MVP

| Area | Included |
|---|---|
| Languages | Japanese, German, English — **built sequentially**, Japanese first as the proof of concept (D-46). |
| Tutors | One character per language, fixed native voice (D-32). |
| Auth | Google sign-in only (D-11), 18+ confirmation. |
| Onboarding | Target language, native language, self-assessed level via can-do statements, motivation, strictness preference, microphone check. |
| Conversation | Free conversation on a learner-chosen topic (D-03, D-13); tap-to-talk turns (D-24); tutor speaks first. |
| Help | Escalating hint button + automatic silence nudges (D-26); "You can say…" fallback after 2 unclear attempts (D-17); English-as-help-request handling (D-29). |
| Corrections | Layered: ≤1 implicit spoken recast per turn + on-screen correction cards + end summary; Relaxed/Balanced/Strict (D-14). |
| Listening support | Replay, Slow (≈0.75×), transcript with Hide-text toggle (D-27); tap-to-translate (Hindi on English track, English otherwise) (D-15, D-22). |
| Japanese display | A1: kana + romaji toggle. A2+: kanji with toggleable furigana (D-18). |
| Session | Soft time limit (`SESSION_TARGET_MINUTES`) with polite wrap-up (D-20). |
| Progress | Session summary, recurring-mistakes list, saved vocabulary, per-skill level estimate, suggested next topics (D-16, D-19). |
| Limits | One-time per-account trial (env-controlled), global AI budget kill switch, IP abuse guard (D-10, D-11, D-31). |
| Monetisation | Waitlist screen with optional willingness-to-pay question; **no payments** (D-21, D-44). |
| Admin | Single admin page: spend vs budget, usage, waitlist export, flagged sessions (D-43). |
| Privacy | Transcripts stored; learner audio **only with opt-in**, 30-day retention; history and account deletion (D-42). |
| Platform | Responsive, mobile-first, installable PWA; light mode; WCAG 2.2 AA (D-34, D-35, D-48). |

### 3.2 Explicitly out of scope for the MVP

| Excluded | Reason / when to revisit |
|---|---|
| Payments / paid plans | Validate willingness to pay via waitlist first (D-21). |
| Typing input | Product is speaking practice; revisit if mic failures or accessibility feedback demand it (D-28). |
| Hands-free mode & voice barge-in | Learners pause mid-sentence; phone speakers cause echo (D-24, D-25). |
| Pronunciation scoring | Cannot be done reliably by an LLM; specialised services deferred (see [08](08-language-learning-engine.md)). |
| Tutor choice / multiple tutors per language | Post-MVP (D-32). |
| Spaced-repetition review, streaks, XP, badges, leagues | Post-MVP (D-19, D-36). |
| Dark mode | Tokens prepared; ships later (D-35). |
| Native mobile apps | PWA first (D-34). |
| Exam preparation (JLPT/Goethe/IELTS) | Requires aligned content; post-MVP. |
| UI localisation | UI is English only. |
| Explanation languages beyond English (and Hindi translations on the English track) | Post-MVP (D-12). |
| Replay of the learner's own recordings | Not needed (D-27). |
| Avatar gestures | Post-MVP (D-33). |
| English at A1 | Explanations in English are unusable for A1 English learners (D-22). |

### 3.3 Known limitations accepted for the MVP

- Learners who cannot or may not speak aloud (environment, disability) are not served, because typing is excluded.
- Response latency is turn-based (target 1.5–3 s), not phone-call speed (D-30).
- Level shown is an **estimate**, not a certified proficiency score.
- No pronunciation feedback beyond "I didn't catch that".

---

## 4. Decision register

All decisions confirmed by the product owner during discovery (2026-10-14). Decisions marked **R** are finalised by research in [04-ai-provider-research](04-ai-provider-research.md).

| ID | Area | Decision |
|---|---|---|
| D-01 | Audience | Adults 18+. |
| D-02 | Native language | Asked during onboarding and stored. |
| D-03 | Product focus | Free conversation practice on a learner-chosen topic. The tutor privately holds 1–2 level-appropriate language goals for the topic (no fixed curriculum). |
| D-04 | Levels | A1–B2 (Japanese, German). A1 learners get "starter support": slower speech, closed questions, translations and romaji visible by default, frequent sentence starters. |
| D-05 | Project | Portfolio → possibly commercial; solo developer; no fixed timeline. |
| D-06 | Budget | ≈ $50/month for AI + infrastructure. |
| D-07 | Monetisation | Free trial then paid; trial behaviour controlled by environment variables. |
| D-08 | Market | India; 500–1,000 users in the first months. |
| D-09 | Differentiators | Trustworthy corrections; memorable characters. |
| D-10 | Cost safety | Global kill switch `AI_MONTHLY_BUDGET_USD`; when reached, practice pauses with a friendly screen. |
| D-11 | Identity & trial abuse | Google sign-in required; limits counted per account; IP only as a secondary abuse guard (e.g. ≤3 new trial accounts per IP per day). |
| D-12 | Explanation language | English for everyone; native language stored for future use. |
| D-13 | Topic selection | Tutor opens by asking for a topic; learner speaks a topic or taps a level-appropriate suggestion chip. |
| D-14 | Corrections | Layered: ≤1 implicit spoken recast per turn + on-screen correction card(s) with "Try again" + end-of-session summary. Strictness setting Relaxed / Balanced / Strict. **Never correct when recognition is uncertain.** Accept valid alternatives. |
| D-15 | Language of tutor speech | Tutor speaks only the target language; translations/explanations are text on tap. |
| D-16 | Level | Self-selected at onboarding; stored per-skill estimate updated at the end of every session; changes gradually; labelled "estimated". |
| D-17 | Unclear speech | **One** clarification attempt (`UNCLEAR_MAX_RETRIES=1`, confirmed by owner after research), then "You can say: …", then the conversation moves on. The clarification asks the learner to rephrase/say it more simply and echoes any heard fragment — never a plain "please repeat" ([06 §7](06-ai-tutor-behavior.md)). Configurable. |
| D-18 | Japanese script | A1: kana + romaji toggle. A2+: kanji with toggleable furigana. |
| D-19 | Progress (MVP) | Session summary, recurring mistakes, saved vocabulary, weak spots feed next-topic suggestions. SRS/streaks later. |
| D-20 | Session length | `SESSION_TARGET_MINUTES` (default 5) soft limit; tutor finishes the current exchange, then wraps up; hidden ~2-minute grace safeguard. |
| D-21 | Trial end | "Paid plans coming soon — join the waitlist" screen. No payment integration. |
| D-22 | English track | Starts at A2; simple English; tap-to-translate in **Hindi**. Japanese/German translations and explanations in **English**. |
| D-23 | Time accounting | Only *active* session time counts towards trial and session limits. |
| D-24 | Turn-taking | Tap to talk, tap to send. |
| D-25 | Interrupting | Stop button or tapping the avatar cuts tutor audio; pressing the mic stops audio and starts recording; no voice barge-in. |
| D-26 | Hints & silence | Escalating hint button (hint → sentence starter → full example). Hint button pulses after ~10 s of silence; tutor nudges aloud after ~25 s. Thresholds configurable. |
| D-27 | Replay | Replay and Slow (0.75×) per tutor message; transcript visible by default; Hide-text toggle. No learner-recording replay. |
| D-28 | Typing | No typing in MVP. |
| D-29 | L1/English use | Treated as a help request: tutor gives the target phrase, invites repetition, continues. |
| D-30 | Latency | 1.5–3 s turn latency acceptable; masked by thinking animation and sentence-by-sentence speech. |
| D-31 | Trial scope | `TRIAL_LIMIT_MINUTES` is one-time per account; only applies when `TRIAL_LIMIT_ENABLED=true`. |
| D-32 | Tutors | One character per language with its own native voice; tutor choice post-MVP. |
| D-33 | Avatar behaviour | Viseme lip-sync (8–10 mouth shapes) with amplitude fallback; expressions: idle, listening, thinking, speaking, happy, confused, celebrating; gestures later. |
| D-34 | Devices | Mobile-first responsive web, installable PWA; mid-range Android Chrome on 4G + iOS Safari first; desktop adapted layout. |
| D-35 | Brand | Brand name **Lactice** (owner, 2026-10-14); logo still a placeholder; light mode first; colour tokens prepared for dark mode. |
| D-36 | Gamification | Micro-interactions, end-of-session celebration, simple progress view. No XP/badges/leagues. |
| D-37 | Avatar tech | Layered 2D SVG rig animated by our own controller, 10 mouth shapes, behind a renderer-agnostic interface (Rive-upgradeable). **R — confirmed by research** ([03 Part B](03-design-system-and-avatar-spec.md)). |
| D-38 | Stack | Next.js (TypeScript) + Supabase (Postgres, Google auth, storage). |
| D-39 | Hosting | **Google Cloud Run, asia-south1 (Mumbai)**; Supabase in Mumbai (Free in beta, Pro at public launch). Vercel Hobby rejected (non-commercial). **R** ([04 §7](04-ai-provider-research.md)) |
| D-40 | LLM/STT vendor | LLM: OpenAI `gpt-6-luna` (Claude Haiku 5.5 failover). STT: **Deepgram Nova-3 provisional** (OpenAI's current STT gives no word confidence) — final pick by bake-off. DeepSeek not used with user data. **R** ([04 §3–4](04-ai-provider-research.md)) |
| D-41 | TTS vendor | **Azure standard neural voices provisional** (visemes, kana pronunciation control, no data stored, ≈ $0.015–0.035/session). ElevenLabs (Starter is $6, not $5) only if it wins the blind test decisively. Owner buys nothing until then. **R** ([05 §9](05-voice-and-speech-architecture.md)) |
| D-42 | Audio retention | Not stored by default; opt-in "help improve the tutor" keeps learner audio 30 days. Tutor audio cached only for in-session replay. |
| D-43 | Admin | One admin page: AI spend vs limit, sessions/active users, waitlist export, flagged sessions (≥2 "didn't catch that" loops). |
| D-44 | Waitlist | Optional question "What would you pay per month?" (₹199 / ₹399 / ₹799 / Other). |
| D-45 | Success | (a) It works correctly and reliably; (b) learning quality (low false corrections, good recovery). |
| D-46 | Proof of concept | Japanese first. |
| D-47 | Ops defaults | Sentry + PostHog free tiers; GitHub Actions CI; tutor declines explicit/hateful/dangerous topics and redirects; rate limits per account and per IP. |
| D-48 | Accessibility | WCAG 2.2 AA; transcript acts as captions; full keyboard support (Space = talk on desktop); reduced-motion honoured; sound effects with toggle. |
| D-49 | English tutor voice | **American (en-US) accent** for Sam; Indian English learner features remain valid (allowlist, [08 §3.3](08-language-learning-engine.md)). |
| D-50 | German address form | Lena uses **du** in free conversation; *Sie* in formal topics (service, work, interview). |

---

## 5. Functional requirements

Priority: **M** = must (MVP), **S** = should (MVP if time allows), **L** = later.

### 5.1 Account & onboarding

| ID | Requirement | Pri |
|---|---|---|
| FR-01 | User signs in with Google. No email/password. | M |
| FR-02 | First sign-in shows a neutral date-of-birth age gate (under-18 blocked, DOB not stored), the privacy notice (English + Hindi), and separate consents (core tutoring; optional analytics; optional audio retention); each recorded with timestamp and notice version ([14 §3](14-security-and-privacy.md)). | M |
| FR-03 | Onboarding collects: target language, native language, self-assessed level (can-do statements), motivation(s), correction strictness (default Balanced). | M |
| FR-04 | English track offers only A2–B2 level options. | M |
| FR-05 | Onboarding includes a microphone permission + test step with platform-specific fix instructions on failure. | M |
| FR-06 | User can change target language; each target language has its own level estimate, history and vocabulary. | M |
| FR-07 | Opt-in toggle "Help improve the tutor (keep my audio for 30 days)", default **off**. | M |

### 5.2 Conversation

| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Tutor greets the learner by name and asks for a topic; suggestion chips (3–4) based on level, motivation and weak spots, plus "Surprise me". | M |
| FR-11 | Learner taps the mic to start recording and taps again to send. Maximum recording length 30 s (auto-send with notice). | M |
| FR-12 | Before upload, the client checks for speech presence (energy-based VAD); clips with no speech trigger the "didn't hear anything" path without calling STT. | M |
| FR-13 | Tutor reply is streamed as audio sentence by sentence with synchronised transcript text and avatar lip-sync. | M |
| FR-14 | Stop button / avatar tap stops tutor audio immediately; mic press during tutor speech stops audio and starts recording. | M |
| FR-15 | Each tutor message has Replay and Slow controls. | M |
| FR-16 | Transcript visible by default; Hide-text toggle per session. | M |
| FR-17 | Tap-to-translate on each tutor message (Hindi on English track; English for Japanese/German). | M |
| FR-18 | Japanese text rendering follows D-18 with per-user toggles. | M |
| FR-19 | Hint button always visible; each press escalates hint → sentence starter → full example for the current tutor question. | M |
| FR-20 | Silence nudges per D-26 using configurable thresholds. | M |
| FR-21 | Unclear-speech recovery per D-17 with a deterministic retry counter. | M |
| FR-22 | Learner use of English (or other L1) is classified and handled as a help request (D-29). | M |
| FR-23 | Session soft limit per D-20; tutor closes politely; summary follows. | M |
| FR-24 | Session resumes after a network drop if reconnected within 2 minutes; otherwise it ends with a partial summary. | M |
| FR-25 | Tutor declines unsafe topics politely and offers alternatives. | M |

### 5.3 Corrections & feedback

| ID | Requirement | Pri |
|---|---|---|
| FR-30 | Corrections are only produced for turns whose transcript is classified as reliably captured. | M |
| FR-31 | At most one implicit spoken recast per tutor turn. | M |
| FR-32 | Additional errors (per strictness) appear as correction cards: original → corrected, short English explanation, "Try again". | M |
| FR-33 | "Try again" records a new attempt for that card; success is acknowledged briefly. | M |
| FR-34 | Valid alternative expressions are accepted; the tutor may offer a *more natural* alternative labelled as optional, never as an error. | M |
| FR-35 | Learner can report a correction as wrong ("This was right" / "You misheard me"); reports feed the evaluation dataset. | M |

### 5.4 Progress

| ID | Requirement | Pri |
|---|---|---|
| FR-40 | End-of-session summary: corrections (with explanations), new words, 1–3 things done well, speaking time, hint usage, level-estimate change (if any). | M |
| FR-41 | Recurring-mistakes list: error categories seen in ≥2 sessions, with examples and last-seen date. | M |
| FR-42 | Saved vocabulary: words introduced or corrected, with reading (Japanese), meaning, example sentence; learner can save/remove. | M |
| FR-43 | Per-skill level estimate (grammar, vocabulary, fluency, comprehension) updated gradually after each completed session. | M |
| FR-44 | Dashboard: estimated level, minutes practised, sessions completed, mistakes fixed, recurring mistakes, saved vocabulary, suggested next topics. | M |
| FR-45 | Conversation history: list of past sessions with transcript and corrections. | M |
| FR-46 | Spaced-repetition review, streaks. | L |

### 5.5 Limits, waitlist, admin

| ID | Requirement | Pri |
|---|---|---|
| FR-50 | Trial limit per D-31 counts active seconds server-side; when exhausted mid-session, the soft wrap-up rule applies. | M |
| FR-51 | Global AI spend tracked per call; when month-to-date spend ≥ `AI_MONTHLY_BUDGET_USD`, new sessions are blocked and active sessions wrap up. | M |
| FR-52 | IP abuse guard on trial account creation and per-IP request rate limits. | M |
| FR-53 | Waitlist screen with optional price question; email from Google profile. | M |
| FR-54 | Admin page (allow-listed admin emails): spend vs budget, sessions, active users, waitlist export (CSV), flagged sessions. | M |
| FR-55 | Account deletion and history deletion, effective immediately in the app and within 30 days in backups/processors. | M |

---

## 6. Configuration (environment variables)

All product limits are configuration, not code. Defaults in **bold**.

| Variable | Default | Meaning |
|---|---|---|
| `TRIAL_LIMIT_ENABLED` | **true** | If true, each account gets a one-time trial of `TRIAL_LIMIT_MINUTES` active minutes. If false, no trial limit (budget kill switch still applies). |
| `TRIAL_LIMIT_MINUTES` | **5** | One-time trial allowance per account. |
| `SESSION_TARGET_MINUTES` | **5** | Soft session length; tutor wraps up after the current exchange. |
| `SESSION_GRACE_SECONDS` | **120** | Hidden safeguard: hard end if wrap-up hasn't completed. |
| `AI_MONTHLY_BUDGET_USD` | **50** | Global month-to-date AI spend ceiling. |
| `SILENCE_HINT_PULSE_SECONDS` | **10** | Hint button pulse after silence. |
| `SILENCE_NUDGE_SECONDS` | **25** | Tutor spoken nudge after silence. |
| `UNCLEAR_MAX_RETRIES` | **1** | Clarification attempts before "You can say…" (D-17). |
| `MAX_RECORDING_SECONDS` | **30** | Auto-send after this. |
| `TRIAL_ACCOUNTS_PER_IP_PER_DAY` | **3** | Abuse guard. |
| `RECONNECT_WINDOW_SECONDS` | **120** | Session resume window after disconnect. |
| `ADMIN_EMAILS` | — | Comma-separated admin allow-list. |

Full list including provider keys: [15-deployment-and-operations](15-deployment-and-operations.md).

---

## 7. Non-functional requirements

| ID | Requirement | Target (provisional — confirmed after PoC baseline) |
|---|---|---|
| NFR-01 | Turn latency: end of learner recording (tap send) → first tutor audio | median ≤ 2.5 s, p90 ≤ 4 s on 4G |
| NFR-02 | Session reliability | ≥ 99% of started sessions end in a summary (complete or partial) without a crash |
| NFR-03 | Mobile performance | Conversation screen interactive ≤ 3 s on mid-range Android over 4G (cached assets); avatar ≥ 30 fps |
| NFR-04 | Initial load | Landing page LCP ≤ 2.5 s on 4G; conversation route JS ≤ 250 KB gzipped excluding avatar asset |
| NFR-05 | Accessibility | WCAG 2.2 AA |
| NFR-06 | Privacy | No learner audio persisted without opt-in; all data deletable; processors don't train on our data |
| NFR-07 | Cost | Month-to-date AI spend never exceeds `AI_MONTHLY_BUDGET_USD` by more than the cost of sessions already in flight |
| NFR-08 | Browser support | Chrome Android (last 2 versions), Safari iOS 16.4+, desktop Chrome/Edge/Firefox/Safari (last 2 versions) |
| NFR-09 | Observability | Every turn traced with latency per stage, provider, cost, classification outcome |

---

## 8. Success criteria (D-45)

Measured on the evaluation sets in [13-testing-and-evaluation](13-testing-and-evaluation.md) and production telemetry. Numbers are **provisional release gates**, to be re-baselined after the Phase 2 proof of concept.

| Goal | Metric | Gate |
|---|---|---|
| Works correctly | Sessions ending without crash/abandonment due to error | ≥ 99% |
| Works correctly | Core flows pass on target device matrix | 100% of P0 test cases |
| Trustworthy corrections | False-positive correction rate (correction issued where native rater says no error, incl. ASR-induced) | ≤ 5% per language |
| Trustworthy corrections | Correction precision on genuine errors (correct fix) | ≥ 90% |
| Honest understanding | Unclear-speech test items ending in clarification or suggestion (not invented interpretation) | ≥ 95% |
| No dead ends | Learner stuck beyond `UNCLEAR_MAX_RETRIES` | 0 occurrences (deterministic) |
| Responsiveness | Turn latency | median ≤ 2.5 s, p90 ≤ 4 s |
| Voice consistency | Listening-test and speaker-similarity checks | Pass per [05](05-voice-and-speech-architecture.md) protocol |
| Cost | AI cost per 5-minute session | within budget model in [12](12-cost-and-performance-model.md) |

Product signals tracked but not gated for MVP: session completion rate, 7-day return rate, trial → waitlist conversion, willingness-to-pay distribution, correction "report wrong" rate.
