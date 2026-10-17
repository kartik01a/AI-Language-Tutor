# 04 — AI Provider Research & Selection

> Related: [05 Voice & speech architecture](05-voice-and-speech-architecture.md) · [12 Cost model](12-cost-and-performance-model.md) · [research/provider-comparison.md](research/provider-comparison.md) · [research/sources.md](research/sources.md)
> Detailed evidence: [STT & LLM notes](research/notes/stt-and-llm.md) · [TTS & voice notes](research/notes/tts-and-voice.md) · [Infra & privacy notes](research/notes/infra-browser-privacy.md) · [Avatar notes](research/notes/avatar-lipsync-japanese-text.md)

All prices and capabilities were checked on **2026-10-14** against official pages where possible. Labels: **VERIFIED** (official/primary source), **REPORTED** (secondary), **ESTIMATE** (our calculation). Prices change frequently — re-check before purchase. Every recommendation here is **provisional until the Phase 0/2 bake-offs** ([16](16-implementation-roadmap.md)) confirm it with our own audio.

---

## 1. Summary of selections

| Component | Primary (provisional) | Credible alternative(s) | Decided by |
|---|---|---|---|
| Architecture | **Cascaded, turn-based**: STT → LLM (strict JSON) → TTS, sentence-streamed | Speech-to-speech realtime (rejected for MVP) | §2 |
| Speech-to-text | **Deepgram Nova-3** (word confidence, `en-IN`, $200 free credit, per-request training opt-out) | **ElevenLabs Scribe v2** (best English WER, word logprobs); **Azure Speech STT** (same vendor as TTS, data not stored); OpenAI `gpt-transcribe` (cheap, **no confidence**) | STT bake-off (Phase 0) |
| Tutor LLM | **OpenAI `gpt-6-luna`**, reasoning `none`, strict structured outputs | **Claude Haiku 5.5** (same price class, failover); `gpt-6-sol` for end-of-session analysis if quality requires | LLM eval (Phase 2) |
| Text-to-speech | **Azure AI Speech, standard neural voices** (visemes, kana phoneme control, rate, no data stored, $15/1M chars) | **ElevenLabs Flash v2.5 / v4 Turbo** (Starter $6 + top-ups) if it wins the blind test decisively; Google Neural2 / Chirp 3 HD | Blind listening test (Phase 0) |
| Lip-sync timing | Azure viseme events | Character alignment (ElevenLabs) → visemes; audio analysis fallback | Avatar spike (Phase 0) |
| Japanese readings | kuroshiro + kuromoji (server) + override dictionary | Lindera (Wasm, UniDic) | Phase 2 |
| Hosting | **Google Cloud Run, asia-south1 (Mumbai)** | Cloudflare Workers Paid ($5) + OpenNext | §7 |
| DB / Auth / Storage | **Supabase, ap-south-1 (Mumbai)** | — | §7 |

**Answer to the owner's ElevenLabs question (D-41):** do **not** buy ElevenLabs yet. Run the blind test first ([05 §9](05-voice-and-speech-architecture.md)). If ElevenLabs wins decisively, buy **Starter ($6/month — not $5)** and top up pay-as-you-go; its included usage covers only ≈ 75 English sessions/month on Flash, so it cannot be the cost basis for 500–1,000 users.

---

## 2. Conversation architecture: cascaded vs speech-to-speech vs hybrid

| Criterion | **A. Cascaded STT → LLM → TTS (chosen)** | B. Speech-to-speech realtime (e.g. OpenAI `gpt-realtime-2.1-mini`, GPT-Live 1, Gemini Live) | C. Hybrid (realtime voice + separate analysis) |
|---|---|---|---|
| Naturalness | Turn-based; 1.5–3 s latency | Most natural; sub-second, full duplex | Natural voice, analysis lags |
| Fit with tap-to-talk (D-24) | Native | Full-duplex is wasted; GPT-Live bills session time incl. silence | Partial |
| Uncertainty gate ("never invent meaning") | **Clean gate point**: word confidences before the LLM sees anything | Model hears and answers in one step; transcript is a side channel and may differ from what the model understood | Gate only for analysis, not for the spoken reply |
| Deterministic control (retries, templates) | Full | Hard; needs tool calls / client delegation | Partial |
| Voice consistency & accent | Choose any TTS with fixed native voices | Built-in voices only ("optimised for English" for OpenAI TTS voices **VERIFIED**) | Same as B |
| Lip-sync timing | Viseme events / alignment available | None documented → audio analysis | Same as B |
| Observability & evaluation | One auditable record per turn (STT text, JSON, action) | Audio + transcripts | Mixed |
| Cost per 5-min session (STT+LLM, excl. TTS) | **≈ $0.01** (ESTIMATE) | ≈ $0.07–0.08 (realtime-mini) · ≈ $0.22–0.24 (realtime-2.1) · ≈ $0.26 (GPT-Live) (ESTIMATE) | ≈ B + analysis |
| Vendor lock-in | Low (thin interfaces per stage) | High | High |

**Decision:** A. It's the only option that enforces the trust requirements in code and fits the $50 budget. Revisit B (GPT-Live with client delegation) only if a future hands-free mode is prioritised and budget allows ([17](17-risks-and-open-decisions.md)).

**Separate models per task:** yes — STT (specialised), LLM turn call (fast, cheap, strict JSON), correction detection (same cheap model, 3 samples + deterministic gates), explanation (same model), end-of-session analysis (same model at higher reasoning effort, optional upgrade), pronunciation analysis (none in MVP; Azure Pronunciation Assessment supports ja-JP/de-DE/en-IN/hi-IN as a future option **VERIFIED**), progress tracking (deterministic code).

---

## 3. Speech-to-text

### 3.1 What matters for us

1. **Per-word confidence** — the core of "don't correct what we may have misheard" ([06 §4](06-ai-tutor-behavior.md)).
2. **Japanese/German/Indian-accented accuracy on learner speech**, and **error preservation** (ASR systems "auto-correct" learner grammar — Whisper, Google and Rev AI all did on Japanese learners' English **REPORTED**).
3. Behaviour on silence/short clips (Whisper-family phantom phrases such as ご視聴ありがとうございました **REPORTED**).
4. Data policy, cost, latency from India, model lifetime.

### 3.2 Comparison (details in [provider-comparison](research/provider-comparison.md))

| Provider / model | Price | Word confidence | ja / de / en-IN | Data | Notes |
|---|---|---|---|---|---|
| **Deepgram Nova-3** | $0.0043/min mono, $0.0052 multi (pre-recorded); **$200 free credit** **VERIFIED** | ✓ word + alternative **VERIFIED** | ✓ / ✓ / **en-IN listed** | Training opt-out per request (`mip_opt_out=true`) — default appears opt-in (**REPORTED**) | Lowest English WER of the group on one benchmark (5.2% AA-WER **REPORTED**); credit ≈ 25,000 sessions of STT |
| **ElevenLabs Scribe v2** | $0.22/h ≈ $0.0037/min **VERIFIED** | ✓ word logprob + language probability **VERIFIED** | ✓ / ✓ / — | Zero retention enterprise-only; training policy unverified | Best English AA-WER 2.2% (**REPORTED**); weaker Japanese CER for the Realtime variant in one competitor paper |
| **Azure Speech STT** | Real-time $1.00/h ≈ $0.0167/min; Fast Transcription $0.36/h; **5 h/month free (F0)** **VERIFIED** | ✓ NBest + word-level (**REPORTED**) | ✓ / ✓ / ✓ | Real-time audio **not stored** **VERIFIED** | Same vendor/region as TTS; 3–4× the cost |
| OpenAI `gpt-transcribe` | $0.0045/min **VERIFIED** | ✗ (only detected-language list) **VERIFIED** | ✓ / ✓ / — | No training; transcriptions not retained for abuse monitoring **VERIFIED** | New (Jul 2026); no independent ja/de evidence |
| OpenAI `gpt-4o(-mini)-transcribe`, `whisper-1` | — | logprobs | — | — | **Shut down 2027-02-26** **VERIFIED** — evaluation only |
| Groq Whisper large-v3(-turbo) | $0.111/h (10 s min per request) | segment-level | ✓ | No retention by default | Good cheap **second-opinion** STT for low-confidence clips |

### 3.3 Recommendation

**Provisional primary: Deepgram Nova-3** (with `mip_opt_out=true` on every request), because it combines word confidence, explicit `en-IN` support, an opt-out from training, and a free credit that makes STT effectively free for the MVP's volume. **Alternatives:** Scribe v2 (if it is clearly more accurate on our Japanese learner set and its data terms are acceptable), Azure STT (if latency/accuracy are best and the extra cost is affordable). *This deviates from the STT research note, which ranked Scribe v2 first on accuracy and price; the deciding factors here are the free credit and the clearer per-request training opt-out — the bake-off decides.*

**Bake-off (Phase 0, < $1 of API cost):** 60–100 clips of Indian learners speaking Japanese (first), German and English at A1–B2, including deliberate errors, silence, noise and code-switching. Metrics: CER/WER, **error preservation rate**, phantom output on silence, confidence calibration (can τ_word separate misrecognised words?), p50/p95 latency from India. Acceptance in [13 §3](13-testing-and-evaluation.md).

**Never:** put the expected answer in STT prompts/keywords (biases toward correct text).

---

## 4. Tutor LLM

| Model | Price per 1M tokens (in / cached / out) | Structured output | Notes |
|---|---|---|---|
| **OpenAI `gpt-6-luna`** | $0.10 / $0.01 / $0.50 (cache write $0.125) **VERIFIED** | **Strict JSON schema**, keys in schema order **VERIFIED** | Reasoning `none` → TTFT ≈ 0.74–0.94 s; `low` ≈ 1.6–2.6 s (**REPORTED**, Artificial Analysis). Released 2026-09-22. No training on API data; set `store: false` |
| Claude Haiku 5.5 | $0.10 / $0.01 / $0.50 **VERIFIED** | Structured outputs | No training on API data by default **VERIFIED**; latency unverified — failover peer |
| `gpt-6-sol` | $2 / $0.20 / $10 | ✓ | Quality reference / analysis upgrade (≈ $0.027 per analysis) |
| DeepSeek `deepseek-flash` | $0.30 / $0.006 / $1.20 (peak; 50% off-peak) | JSON mode only, **not schema-enforced**; may return empty content **VERIFIED** | Data stored in China; API terms silent on training → **not for learner data** |
| Gemini Flash / Flash-Lite | $0.25–0.75 in / $1.50–3.75 out | JSON schema subset | Free tier **uses data for product improvement** (human review possible) **VERIFIED** → paid tier only |
| `gpt-5-mini` / `gpt-5-nano` | — | — | **Snapshots shut down 2026-12-11** — don't build on them |

**Recommendation:** `gpt-6-luna` (effort `none`) for turn calls and correction sampling; effort `low` for end-of-session analysis. **Claude Haiku 5.5** behind the same interface as failover and as the A/B quality peer. The owner's DeepSeek credit can be used for offline content drafting (topic lists, example sentences) — never with learner data.

**Unknowns to measure (Phase 2):** Japanese/German correction precision at effort `none` (no public benchmark exists for these models on learner Japanese **REPORTED gap**), TTFT from asia-south1, schema-adherence failures.

---

## 5. Text-to-speech (summary — full strategy in [05](05-voice-and-speech-architecture.md))

| Provider | $/1M chars | Timing for lip-sync | Japanese reading control | Slow via provider | Data |
|---|---|---|---|---|---|
| **Azure standard neural** | **15** (kanji billed as 2 chars) **VERIFIED** | **Viseme IDs + word boundaries** (ja-JP viseme support documented inconsistently — test day 1) | SSML `<phoneme>` kana "sapi" set, custom lexicon, `<sub>` | `<prosody rate>` | **Not stored** **VERIFIED** |
| ElevenLabs Flash v2.5 / v4 Turbo | 40 | Character alignment | Alias dictionaries; phoneme tags English-only model | `speed` 0.7–1.2 (Flash); none on v4 | Retained by default; zero-retention enterprise-only |
| ElevenLabs v4 / Multilingual v2 | 80 | Character alignment | Alias, inline IPA (v4) | none on v4 | same |
| Google Neural2 / Chirp 3 HD | 16 / 30 (1M free/month) | `<mark>` timepoints (Neural2); none (Chirp) | `yomigana` phoneme | `speaking_rate` | not checked |
| OpenAI gpt-4o-mini-tts / tts-1 | ≈ $0.015/min / $15 | none | none | disputed | 30-day abuse logs; **models retire 2027-01-06** **VERIFIED**; cross-request voice inconsistency **REPORTED** |

**Why Azure is primary:** fixed native voices (e.g. `ja-JP-NanamiNeural`), viseme events for the SVG avatar, kana-level pronunciation control for kanji misreadings, rate control, no data retention, lowest cost per session of the options with timing data (≈ $0.015 Japanese / $0.03 English per session **ESTIMATE**). **Risk:** standard voices may sound less expressive than ElevenLabs — the blind test quantifies this. **Avoid** Azure `DragonHDLatestNeural` voices (no visemes/rate, float to the latest model, deliberate variation **VERIFIED**).

---

## 6. Pronunciation assessment (post-MVP)

Azure Pronunciation Assessment covers ja-JP, de-DE, en-IN, hi-IN and others with accuracy, fluency and miscue scores **VERIFIED**. Not in MVP (D-17, [08 §11](08-language-learning-engine.md)); any adoption must first be validated against native-rater judgements on Indian-L1 learner audio.

---

## 7. Hosting, database and supporting services

| Need | Choice | Why | Alternative |
|---|---|---|---|
| App + API hosting | **Cloud Run, asia-south1**, Next.js standalone container, request-based billing, min 0 / max 3 instances, concurrency ~40, 1 vCPU / 1 GiB (Japanese analyzer needs ~430 MB **VERIFIED in test**) | Commercial use allowed; free tier ≈ first 100–190 MAU; streaming supported; Mumbai is a Tier-1 price region; spend caps available (GA Oct 2026 **REPORTED**); portable container = low lock-in | **Cloudflare Workers Paid ($5)** + OpenNext: CPU-time billing and no egress fees make it far cheaper at scale (≈ $5–6/month at 10k MAU vs ≈ $57), but adapter risk (Cloudflare now steers to beta "vinext"), 128 MB memory (too small for the Japanese analyzer). Migration path: move only `/api/turn` later if Cloud Run compute > $20/month |
| Rejected hosts | Vercel Hobby (**non-commercial only** **VERIFIED**), Render Free ("do not use for production"), Fly.io (no free tier for new orgs), Workers Free (10 ms CPU limit) | | |
| Database/Auth/Storage | **Supabase**, Mumbai region; Free during development (weekly `db dump` backup via GitHub Action, keep-alive to avoid the 7-day pause); **Pro ($25/month) at public launch** | Postgres + Google OAuth + Storage + RLS in one; co-located with Cloud Run | Neon + Auth.js (more pieces) |
| Rate limiting | Postgres counters + per-instance token bucket | $0, one fewer processor | Upstash Redis (≈ $5 at 10k MAU) |
| Errors | Sentry Developer (free: 5k errors, 1 user) | | |
| Analytics | PostHog free (1M events, 5k recordings) — trimmed to ~10 events/session | | |
| CI | GitHub Actions (2,000 free minutes/month private) | | |

---

## 8. Vendor lock-in & migration

| Layer | Interface we own | Switching cost |
|---|---|---|
| STT | `transcribe(audio, langs) → { text, words: [{w, start, end, conf|null}], lang, langConf }` | Low: re-calibrate thresholds; rerun eval |
| LLM | `tutorTurn(prompt, schema) → stream<JSON>`; provider-neutral JSON schema | Low–medium: prompt tuning; rerun eval |
| TTS | `synthesize(text, voiceConfig) → { audio: mp3 chunks, visemes: VisemeTrack, words }` | **High for the product** — the voice *is* the character. Mitigate: pin voice + model, cache static audio, keep provider-neutral ruby annotations instead of SSML in content |
| Hosting | Standard Docker container | Low |
| DB | Postgres + SQL migrations | Low–medium (Supabase Auth is the sticky part) |

OpenAI deprecates models on short cycles (four STT models and the TTS models retire within ~4 months of research date **VERIFIED**) → pin snapshots, keep the eval set in the repo so a model swap is a one-day regression run.
