# 13 — Testing, Evaluation & Release Gates

> Related: [06 Tutor behaviour](06-ai-tutor-behavior.md) · [05 Voice §8–9](05-voice-and-speech-architecture.md) · [01 §8 Success criteria](01-product-requirements.md) · [16 Roadmap](16-implementation-roadmap.md)

Building successfully proves nothing about a tutor. This plan tests the **AI behaviour** (understanding, corrections, voice) as rigorously as the code. Principles: measure on our own learner audio; never claim perfect recognition or zero hallucination; every release is compared to the previous one on the same frozen datasets.

---

## 1. Test layers

| Layer | What | Tooling | When |
|---|---|---|---|
| Unit | Dialogue machine `step()` (every row of [07 §3.4](07-conversation-state-machine.md)), correction gates, strictness caps, level-update math, limits/budget, Japanese overrides, viseme mapping, frame codec | Vitest | every commit |
| Contract | Zod schemas ↔ JSON schemas; provider adapters against recorded fixtures | Vitest + recorded responses | every commit |
| Integration | Turn pipeline with fake providers (deterministic fixtures) incl. timeouts, retries, 409 conflicts, resume | Vitest + MSW | every commit |
| E2E | Onboarding → session → summary on Chromium + WebKit with fake mic audio files; mic-denied flows; offline banner | Playwright (`--use-file-for-fake-audio-capture`) | every PR |
| Visual | Avatar states/visemes; key screens | Playwright screenshots | every PR touching UI/avatar |
| Accessibility | axe-core on all routes; keyboard-only E2E; contrast check of tokens | @axe-core/playwright | every PR |
| **AI evaluation** | Datasets in §3 run against the real providers | `/eval` runners → JSON reports | nightly subset; full before each release |
| Voice regression | [05 §8](05-voice-and-speech-architecture.md) metrics | Python scripts (Whisper, ECAPA, parselmouth) | nightly + before voice/model changes |
| Device | Real-device matrix (§6) | manual checklist | before each beta release |
| Load | Turn endpoint with fake providers; provider rate-limit rehearsal | k6 | Phase 6 |
| Security | Dependency audit, secret scan, RLS policy tests, authz tests per endpoint | npm audit, gitleaks, pgTAP / SQL tests | every PR / weekly |

---

## 2. Evaluation methodology

- **Datasets are versioned** in `/eval/datasets/{lang}/v{n}` (audio + JSON labels). Audio from consenting contributors only, with a signed consent note; synthetic TTS audio is used only for robustness variants, never as the sole evidence.
- **Labels by humans:** native-speaker (or teacher) labels for transcripts, intended meaning, genuine errors (taxonomy code), acceptable alternatives. Two labellers on 20% of items; disagreement resolved; inter-rater agreement reported.
- **Runs are reproducible:** pinned provider model ids, prompt versions and thresholds recorded in each report.
- **LLM-as-judge** only for *scaled* naturalness/helpfulness screening, calibrated against ≥ 50 human-rated items per language and never as the sole gate for correctness metrics.

---

## 3. Datasets (Japanese first; then German, English)

Minimum sizes for the PoC gate (Phase 2), expanded for MVP (Phase 5).

| Set | Content | PoC size (ja) | MVP size (each lang) |
|---|---|---|---|
| **S1 STT accuracy & error preservation** | Indian learners A1–B2 reading/answering; ~30% containing deliberate genuine errors (e.g. 「公園を行きました」, "Ich habe gegangen", "He go to school") | 60 clips | 150 |
| **S2 Silence/noise/short** | silence, breath, TV/traffic, fan, 0.5–2 s clips, second speaker | 30 | 60 |
| **S3 Code-switching** | English/Hindi inside target-language answers; "how do you say…" | 20 | 40 |
| **S4 Turn understanding** | transcripts + context labelled with the expected category ([07 §3.3](07-conversation-state-machine.md)) incl. ambiguous, off-topic, misunderstood-question, don't-know, meta requests | 150 | 300 |
| **S5 Correction precision** | understood learner utterances with labelled genuine errors **and** labelled acceptable variants (incl. Indian English allowlist items for en; register shifts for ja; colloquial *weil*+V2 for de) | 150 | 400 |
| **S6 ASR-induced errors** | pairs (true utterance, ASR transcript with plausible mishearing on fragile tokens) with confidences | 50 | 100 |
| **S7 Conversation scenarios** | scripted multi-turn learner simulations for scenarios A–P ([07 §6](07-conversation-state-machine.md)) | 16 scripts | 40 |
| **S8 Level/adaptation** | transcripts of sessions at known levels (teacher-rated) | 20 | 60 |
| **S9 Voice corpus** | [05 §8](05-voice-and-speech-architecture.md) (~40 lines) | 40 | 40 |

Sources of learner audio: friends/colleagues learning Japanese/German, language-exchange partners, small paid sessions with learners; teacher-recorded "learner-style" errors to fill gaps. Public sets for English robustness checks (e.g. Speak & Improve, L2-ARCTIC — check licences) are supplementary only.

---

## 4. Metrics & acceptance thresholds

Thresholds are **provisional**; Phase 2 re-baselines them. "Gate" = must pass for release.

### 4.1 Recognition & understanding

| Metric | Definition | Gate (PoC → MVP) |
|---|---|---|
| CER (ja) / WER (de, en) on S1 | vs human transcript | report; choose STT by it (no fixed gate) |
| **Error preservation** | % of genuine learner errors in S1 still present in the transcript | report; ≥ 60% desirable (ASR normalises errors — missing an error is the safe failure) |
| **Phantom rejection** | % of S2 clips ending in `NO_SPEECH`/`UNCLEAR_AUDIO` (never an invented transcript acted upon) | ≥ 95% → ≥ 97% |
| **False "didn't catch that"** | % of clean, intelligible S1 clips classified unclear | ≤ 15% → ≤ 10% |
| **Category accuracy** | S4 macro-F1 | ≥ 0.80 → ≥ 0.85 |
| **Never pretend to understand** | % of S4 items labelled not-understood/ambiguous where the tutor reply asserts a specific meaning | ≤ 5% → ≤ 3% |
| L1 help detection | S3 recall for `native_language_help` | ≥ 0.90 |

### 4.2 Corrections (the differentiator)

| Metric | Definition | Gate |
|---|---|---|
| **False-positive correction rate** | shown cards on S5 + S6 that native raters judge "not an error" (incl. ASR-induced and valid variants) ÷ all shown cards | **≤ 5%** per language |
| **Card precision** | shown cards with a correct fix and correct explanation | ≥ 90% → ≥ 95% (research launch target) |
| ASR-induced corrections | cards produced on S6 low-confidence spans | **0** (deterministic gate — any occurrence is a bug) |
| Valid-variant acceptance | S5 acceptable variants (incl. Indian English allowlist) flagged as errors | ≤ 2% |
| Recall (secondary) | genuine errors surfaced (any card or summary) | report; ≥ 50% at Balanced |
| Explanation quality | native-rater 1–5 on clarity/correctness for 50 cards | mean ≥ 4.0 |
| Production signal | learner "This was wrong" reports per 100 cards | alert > 3; auto-disable a taxonomy category when its report rate > 10% over ≥ 30 cards |

### 4.3 Conversation & teaching

| Metric | Definition | Gate |
|---|---|---|
| Scenario pass rate | S7 scripts reach the expected states/actions (deterministic checks) | 100% |
| Retry loops | learner stuck beyond `UNCLEAR_MAX_RETRIES` | 0 |
| Repeated-question rate | tutor asks a semantically duplicate question within a session (embedding sim ≥ 0.9) | ≤ 5% of sessions |
| Level adherence | replies within level word budget and question style | ≥ 95% |
| One-question rule | replies ending with exactly one question | ≥ 98% |
| Hint helpfulness | after hint L2/L3, learner produces an understood answer (simulated + real) | report; ≥ 60% in beta |
| Naturalness | native-rater 1–5 on 30 session excerpts per language | mean ≥ 4.0 |
| Talk ratio | learner speaking share | ≥ 40% (A1), ≥ 50% (A2+) median in beta |
| Level-estimate consistency | same transcript re-scored 5× → displayed level identical | ≥ 90% |
| Level vs teacher | S8 displayed level within ±1 band of teacher rating | ≥ 80% |

### 4.4 Voice

| Metric | Gate |
|---|---|
| Blind test MOS (naturalness + nativeness) for chosen voice | ≥ 3.8 native panel, ≥ 4.0 learner panel |
| "Same speaker" on own pairs | ≥ 90% |
| Kanji misreadings on S9 ja ambiguity lines (after override layer) | 0 unfixed |
| Speaker-similarity drift (nightly) | no clip below reference mean − 3σ |
| Audio playback failures (production) | ≤ 0.5% of tutor messages |

### 4.5 Product quality

| Metric | Gate |
|---|---|
| Turn latency | p50 ≤ 2.5 s, p90 ≤ 4 s (4G, Mumbai region) |
| Session crash/abandon-by-error | ≤ 1% |
| Accessibility | 0 axe "serious/critical"; keyboard E2E pass |
| Device matrix | all P0 cases pass (§6) |
| Cost per session | within ±25% of [12 §4](12-cost-and-performance-model.md) |
| Security | 0 high/critical findings; RLS tests pass |

---

## 5. Example test items

| ID | Lang | Input | Expected |
|---|---|---|---|
| S1-ja-017 | ja | Audio: 「きのう、ともだちと こうえんを いきました」 (genuine particle error), clear | transcript keeps を; card `ja.particle.destination` |
| S1-ja-042 | ja | Audio: 「わたしは インドから きました」, Hindi-accented, clean | understood; no card |
| S2-ja-003 | ja | 3 s of TV noise | `NO_SPEECH`; no LLM call; template line |
| S2-ja-011 | ja | 1.2 s breath + "あ…" | `NO_SPEECH` (VAD) |
| S3-ja-005 | ja | 「私は… how do you say 'engineer'?」 | `native_language_help`; teach エンジニア; no error |
| S4-ja-088 | ja | Q: 何時に起きますか？ A: 「はい、好きです」 | `off_topic/misunderstood_question` → rephrase; no card |
| S5-ja-120 | ja | 「コーヒーのほうが好きです」 to a which-do-you-like question | understood; **no** card (valid) |
| S5-en-033 | en | "I am having two brothers." | understood; **no** Fix card (Indian English allowlist); Strict: optional Tip only |
| S5-de-061 | de | "…, weil ich habe keine Zeit." at B1 | at most severity-1 Tip/summary item, not a live Fix card in Balanced |
| S6-ja-014 | ja | true 「プネに住んでいます」, ASR 「プネで住んでいます」 with で conf 0.38 | correction dropped (`asr_risk`); echo models に |
| S7-ja-D | ja | Scenario D script (2 unclear attempts) | clarify (rephrase) → "You can say" → move on; counters reset (`UNCLEAR_MAX_RETRIES=1`) |

---

## 6. Device & browser matrix (P0)

| Device | Browser / mode | Checks |
|---|---|---|
| Mid-range Android (4 GB RAM, e.g. Samsung A-series / Redmi) | Chrome stable, tab + installed PWA, 4G throttled | mic permission flow, recording format, playback unlock, interrupt, slow replay, avatar ≥ 30 fps, memory over 3 sessions |
| Low-end Android (3 GB) | Chrome | session completes; avatar degrades gracefully |
| iPhone (iOS 18.x) | Safari tab + home-screen PWA | MP4 vs WebM recording, silent switch on, audio session switching, permission persistence after restart, Bluetooth earbuds lip-sync offset |
| iPhone (latest iOS) | Safari | same |
| Desktop | Chrome, Edge, Firefox, Safari | keyboard shortcuts, two-column layout |

---

## 7. Release gates

| Gate | When | Must pass |
|---|---|---|
| **G0 Feasibility** | end of Phase 0 | STT bake-off report; voice blind test decision; Azure viseme check; avatar spike ≥ 30 fps on mid-range Android; measured latency p50 ≤ 3 s |
| **G1 PoC** | end of Phase 2 (ja) | §4.1 PoC thresholds; ASR-induced corrections = 0; scenarios A–G pass; 5 learner sessions observed with no "stuck" reports |
| **G2 Tutor intelligence** | end of Phase 3 | §4.2 gates on ja; §4.3 gates |
| **G3 MVP (per language)** | before each language goes live | §4 MVP thresholds for that language; voice gates; native-speaker review of taxonomy |
| **G4 Production** | before public launch | product-quality gates; security checklist; privacy/DPDP checklist ([14](14-security-and-privacy.md)); load test; backups verified |

A failed gate blocks the phase; the fix is either tuning (prompt, thresholds, taxonomy), a provider swap (interfaces make this cheap), or an explicit, recorded scope decision in [17](17-risks-and-open-decisions.md).
