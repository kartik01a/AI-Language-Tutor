# 12 — Cost, Performance & Scalability Model

> Related: [04 Providers](04-ai-provider-research.md) · [09 Architecture §8](09-system-architecture.md) · Evidence: [STT & LLM §8](research/notes/stt-and-llm.md), [TTS §9](research/notes/tts-and-voice.md), [Infra §9](research/notes/infra-browser-privacy.md)

> ⚠️ **These are estimates, not quotes.** Prices were checked 2026-10-14 (sources in [research/sources.md](research/sources.md)). Usage assumptions are ours. Every number is derived from the formulas below so you can update them in a spreadsheet. Re-validate with real telemetry in Phase 2 (cost per session is logged per turn — [10 §2.10](10-database-and-data-model.md)).

---

## 1. Usage assumptions

| ID | Assumption | Value | Basis |
|---|---|---|---|
| U1 | Session length | 5 min (`SESSION_TARGET_MINUTES`) | D-20 |
| U2 | Learner speech per session | 1.5 min across ~10 learner turns | ESTIMATE |
| U3 | Tutor speech per session | 2.5 min (~12 tutor messages) | ESTIMATE |
| U4 | Tutor characters per session | JA ≈ 750 (≈ 975 Azure-billable, kanji count ×2) · EN ≈ 2,000 · DE ≈ 2,125; +10% SSML overhead | TTS notes §9 |
| U5 | LLM turn calls | 12/session; 3,000 input tokens (2,000 cached static) + ~300 output | STT/LLM notes §8 + our schema |
| U6 | Correction detection | 8 understood turns × 3 samples × (1,500 cached + 400 in + 120 out) | 06 §6 |
| U7 | Explanations | 4 calls × (1,200 in + 150 out) | ESTIMATE |
| U8 | End-of-session | analysis 6,000 in + 2,500 out (incl. reasoning) + can-do ×3 (4,000 in + 200 out) + verifier (2,000 in + 300 out) + 1 rolling summary (1,500 in + 100 out) | 08 §4 |
| U9 | Retries / failed sessions overhead | +10% on AI costs | ESTIMATE; replace with telemetry |
| U10 | Language mix | 40% English, 35% Japanese, 25% German | ASSUMPTION (Indian market) |
| U11 | Engaged usage | 8 sessions per active user per month (≈ 40 min/month; ≈ 1.3 min/day) | ASSUMPTION |
| U12 | Heavy usage | 30 sessions per user per month (daily) | ASSUMPTION |
| U13 | Exchange rate | ₹88 = $1 | ASSUMPTION — update |

## 2. Prices used (VERIFIED 2026-10-14 unless marked)

| Item | Price |
|---|---|
| Deepgram Nova-3 pre-recorded, multilingual | $0.0052/min (mono $0.0043); $200 free credit for new accounts |
| OpenAI `gpt-6-luna` | $0.10 / 1M input · $0.01 cached · $0.125 cache write · $0.50 output |
| Azure Speech TTS, standard neural | $15 / 1M characters (kanji ×2); F0 dev tier 0.5M chars/month |
| ElevenLabs Flash v2.5 / v4 Turbo | $0.04 / 1K chars ($40 / 1M); Starter $6/month |
| Google WaveNet / Standard TTS | $4 / 1M chars, 4M chars/month free |
| OpenAI `gpt-realtime-2.1-mini` | audio in $10/1M tokens, out $20/1M (≈ $0.006/min in, $0.024/min out) |
| Cloud Run (asia-south1, request-based) | $0.000024/vCPU-s, $0.0000025/GiB-s, $0.40/M requests; free 180k vCPU-s, 360k GiB-s, 2M requests/month |
| Supabase Pro | $25/month |

## 3. Formulas

```
STT_session      = learner_min × stt_price_per_min
LLM_turns        = [S×P_write + D×P_in + O×P_out] + (N−1)×[S×P_cached + D×P_in + O×P_out]
                   (S static tokens, D dynamic, O output, N calls)
LLM_corrections  = turns_understood × k × (Sc×P_cached + Dc×P_in + Oc×P_out)
LLM_explain      = n_explain × (Ie×P_in + Oe×P_out)
LLM_end          = Σ end-of-session calls (U8)
TTS_session      = billable_chars × (1 + ssml_overhead) × tts_price_per_char
AI_session       = (STT + LLM + TTS) × (1 + retry_overhead)
AI_per_minute    = AI_session / session_minutes
Monthly_AI       = sessions_per_month × blended AI_session
Per_MAU          = (Monthly_AI + Monthly_infra) / MAU
```

## 4. Cost per session — cost-conscious MVP stack (Deepgram + gpt-6-luna + Azure standard)

| Component | Japanese | English | German | Working |
|---|---|---|---|---|
| STT | $0.0078 | $0.0078 | $0.0078 | 1.5 × $0.0052 |
| LLM — 12 turn calls | $0.0035 | $0.0035 | $0.0035 | (2000×0.125 + 1000×0.10 + 300×0.50)/1e6 + 11×(2000×0.01 + 1000×0.10 + 300×0.50)/1e6 |
| LLM — correction voting | $0.0028 | $0.0028 | $0.0028 | 24 × (1500×0.01 + 400×0.10 + 120×0.50)/1e6 |
| LLM — explanations | $0.0008 | $0.0008 | $0.0008 | 4 × (1200×0.10 + 150×0.50)/1e6 |
| LLM — end of session | $0.0040 | $0.0040 | $0.0040 | analysis 0.0019 + can-do 0.0015 + verifier 0.0004 + summary 0.0002 |
| TTS (Azure) | $0.0161 | $0.0330 | $0.0351 | 975/2000/2125 × 1.1 × $15/1M |
| Subtotal | $0.0350 | $0.0519 | $0.0540 | |
| **+10% retries (U9)** | **$0.039** | **$0.057** | **$0.059** | |
| Per minute | $0.008 | $0.011 | $0.012 | ÷ 5 |

**Blended (U10): ≈ $0.051 per session ≈ $0.010 per minute.** While the Deepgram $200 credit lasts (≈ 25,000 sessions of STT), **≈ $0.042/session**.

**TTS is ~55–65% of AI cost** — the main lever (§7).

## 5. Monthly scenarios

### 5.1 Trial mode (`TRIAL_LIMIT_ENABLED=true`) — what the $50 budget actually buys

Each **new** user gets one 5-minute session.

| New users / month | Sessions | AI cost | Infra | **Total** | vs $50 budget |
|---|---|---|---|---|---|
| 100 | 100 | $5.1 | ≈ $0 (free tiers) | **≈ $5** | ✅ |
| 500 | 500 | $25.5 | ≈ $0 | **≈ $26** | ✅ |
| 1,000 | 1,000 | $51 (≈ $42 with Deepgram credit) | ≈ $0–5 | **≈ $45–56** | ⚠️ at the limit → kill switch may trigger late in the month |
| 10,000 | 10,000 | $510 | ≈ $30–40 (Supabase Pro + Cloud Run) | **≈ $550** | ❌ needs revenue |

Plus fixed: Supabase Pro $25/month **from public launch** (Free with weekly dumps during private beta). Including Pro, the $50 budget comfortably covers **≈ 450 trial users/month**; the kill switch protects the rest.

### 5.2 Engaged / paid mode (8 sessions per active user per month)

| MAU | Sessions | AI | Infra (MP3, lean analytics) | **Total / month** | **Per MAU** |
|---|---|---|---|---|---|
| 100 | 800 | $41 | ≈ $0 | **≈ $41** | $0.41 |
| 1,000 | 8,000 | $408 | ≈ $40–45 | **≈ $450** | $0.45 |
| 10,000 | 80,000 | $4,080 | ≈ $82–113 | **≈ $4,180** | $0.42 |

Heavy users (30 sessions/month) cost ≈ **$1.55/month** each in AI.

### 5.3 Subscription economics (for the waitlist price question)

| Plan price | Net after 18% GST (if inclusive) and ~2% gateway fee (ASSUMPTIONS — verify) | ≈ USD | Margin at 8 sessions ($0.45) | Margin at 30 sessions ($1.60) |
|---|---|---|---|---|
| ₹199/month | ≈ ₹165 | $1.88 | 76% | 15% |
| ₹399/month | ≈ ₹331 | $3.76 | 88% | 57% |
| ₹799/month | ≈ ₹663 | $7.53 | 94% | 79% |

Implication: a ₹199 plan needs a minutes cap (e.g. 60 min/month); ₹399 works with a fair-use cap. Revisit with real usage data and the waitlist's price answers (D-44).

## 6. Architecture comparison (per 5-minute English session)

| Stack | STT | LLM | TTS / voice | **≈ Session** | Notes |
|---|---|---|---|---|---|
| **A. Cost-conscious MVP** (chosen) | Deepgram | gpt-6-luna | Azure standard | **$0.057** | Visemes, kana control, no data retention |
| A′. Budget floor | Deepgram (credit) | gpt-6-luna | Google WaveNet (4M chars free/month) | ≈ $0.02 (≈ $0.016 beyond free tier) | Audio-analysis lip-sync; quality per blind test |
| B. Higher-quality voice | Deepgram | gpt-6-luna | ElevenLabs Flash / v4 Turbo | ≈ $0.11 | Most natural (to be confirmed); data retained by default |
| C. Premium voice | Deepgram | gpt-6-luna + gpt-6-sol analysis | ElevenLabs v4 | ≈ $0.22 | |
| D. Realtime speech-to-speech | — | gpt-realtime-2.1-mini (+ text analysis) | built-in | ≈ $0.08–0.09 | No confidence gate, no visemes, weaker control |
| E. Full-duplex realtime | — | GPT-Live 1 + luna backend | built-in | ≈ $0.26+ | Bills session time incl. silence |

## 7. Cost-reduction levers (without hurting learning)

| Lever | Saving | Effect on experience |
|---|---|---|
| Pre-synthesised template/greeting/recovery audio | 10–20% of TTS | None (more consistent) |
| Client-side Slow and Replay (no re-synthesis) | avoids +100% per press | None |
| Talk-ratio target (shorter tutor turns, [08 §9](08-language-learning-engine.md)) | TTS ∝ tutor chars | Positive (learner speaks more) |
| Correction voting: k=2, add 3rd sample only on disagreement | ~30% of voting cost | None if precision holds (measure) |
| Skip correction pipeline for non-understood turns (already) | — | — |
| Deepgram credit, Azure F0 for dev/eval, OpenAI prompt caching | STT ≈ $0 for MVP volume | None |
| Google WaveNet as fallback TTS tier | TTS −70–100% | Possible quality drop — only if blind test shows parity |
| End-of-session can-do rating ×3 → ×1 for sessions with < 60 s speech (no level update anyway) | small | None |
| Kill switch + per-plan minute caps | bounds worst case | Graceful pause |

## 8. Infrastructure detail

From the infra research (§9): Cloud Run compute ≈ $0 at 100 MAU, ≈ $13–19 at 1,000 MAU (wall-time billing while waiting on AI APIs), ≈ $44–61 at 10,000 MAU; audio egress (MP3 64 kbps ≈ 1.2 MB/session) ≈ $1 at 1,000 MAU, ≈ $13 at 10,000 MAU; Supabase Pro $25 from launch; Sentry/PostHog/GitHub Actions free at MVP scale (keep PostHog ≤ ~10 events/session); avatar assets ≤ 40 KB per tutor, cached immutably (negligible bandwidth). Free-tier exhaustion points: Cloud Run CPU ≈ 190 MAU (engaged mode), egress ≈ 90–150 MAU, Supabase 500 MB DB ≈ 3 months at 1,000 MAU.

## 9. Performance targets

| Metric | Target | Measured by |
|---|---|---|
| Turn latency (send → first audio) | p50 ≤ 2.5 s, p90 ≤ 4 s | per-stage trace ([09 §10](09-system-architecture.md)) |
| STT | p50 ≤ 0.8 s | trace |
| LLM TTFT | p50 ≤ 1.0 s | trace |
| TTS first byte | p50 ≤ 0.3 s | trace |
| Conversation screen interactive (cached assets, mid-range Android, 4G) | ≤ 3 s | Lighthouse + RUM |
| Avatar frame cost | ≤ 2 ms avg, ≤ 4 ms max | Avatar Lab profiling |
| Audio upload size | ≤ 40 KB per 10 s | client metric |

## 10. Scalability & provider limits

- **Cloud Run:** concurrency ~40/instance × max 3 instances = ~120 concurrent turn streams; raise `max-instances` deliberately (it's also a cost guard).
- **Provider rate limits to check before beta:** OpenAI account tier RPM/TPM; Azure S0 default 30 TPS synthesis (adjustable) — F0's 20 transactions/min is too tight for production **VERIFIED**; Deepgram concurrency for pre-recorded requests (not verified).
- **Database:** turn writes ≈ 25 rows/session; at 10k MAU ≈ 2M rows/month — fine for Postgres with the archiving plan in [10 §7](10-database-and-data-model.md).
