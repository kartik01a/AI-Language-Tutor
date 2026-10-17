# Provider Comparison (consolidated)

> Snapshot as of **2026-10-14**. Labels: **V** = verified on an official/primary source, **R** = reported (secondary), **E** = estimate. Full evidence and citations: [sources.md](sources.md) and the notes in [notes/](notes/). Selections and rationale: [04-ai-provider-research.md](../04-ai-provider-research.md).

---

## 1. Speech-to-text

| | Deepgram Nova-3 | ElevenLabs Scribe v2 | Azure Speech STT | OpenAI `gpt-transcribe` | OpenAI 4o(-mini)-transcribe / whisper-1 | Groq Whisper v3 |
|---|---|---|---|---|---|---|
| Price | $0.0043/min mono, $0.0052 multi (pre-recorded) **V**; $200 free credit **V** | $0.22/h ≈ $0.0037/min **V** | $1.00/h real-time; Fast $0.36/h; 5 h/month free **V** | $0.0045/min **V** | ≈ $0.003–0.006/min **V** | $0.111/h, 10 s min per request **V** |
| Word confidence | ✓ word + alternative **V** | ✓ word logprob + language probability **V** | ✓ NBest + word (R) | ✗ **V** | token logprobs / segment logprob **V** | segment-level |
| ja / de / en-IN | ✓ / ✓ / en-IN listed **V** | ✓ / ✓ / – | ✓ / ✓ / ✓ | ✓ / ✓ / – | ✓ | ✓ |
| Silence/hallucination evidence | none verified | audio-event tags | — | none published | whisper-1 phantom phrases on silence (R); 4o-transcribe fine on small JP sample (R) | Whisper-family risk |
| English AA-WER | 5.2% (R) | 2.2% (R) | n/a | 3.3% (R) | 4.0% / 4.5% (R) | 4.6% turbo (R) |
| Data | training opt-out per request `mip_opt_out` (default appears opt-in, R) | zero retention enterprise-only; training policy unverified | real-time audio not stored **V** | no training; transcription not retained for abuse monitoring **V** | same as OpenAI | no retention by default **V** |
| Lifetime | current | current | current | new (Jul 2026) | **shutdown 2027-02-26 V** | open model |
| **Role in plan** | **Primary (provisional)** | Alternative | Alternative | Baseline in bake-off | Eval only | Second opinion |

## 2. LLMs (turn calls, corrections, analysis)

| Model | $/1M in · cached · out | Strict JSON schema | Latency (TTFT) | Data | Role |
|---|---|---|---|---|---|
| OpenAI `gpt-6-luna` | 0.10 · 0.01 · 0.50 (cache write 0.125) **V** | ✓ (schema-ordered keys) **V** | ≈ 0.74–0.94 s at effort `none`; 1.6–2.6 s at `low` (R) | no training by default; `store:false` **V** | **Primary** |
| Claude Haiku 5.5 | 0.10 · 0.01 · 0.50 **V** | structured outputs | not verified | no training by default **V** | Failover / quality peer |
| OpenAI `gpt-6-sol` | 2 · 0.20 · 10 **V** | ✓ | — | as OpenAI | Analysis upgrade |
| DeepSeek `deepseek-flash` | 0.30 · 0.006 · 1.20 peak (50% off-peak) **V** | JSON mode only, not schema-enforced **V** | thinking on by default | stored in China; ToS silent on training **V** | Offline content drafting only |
| Gemini 3.x Flash / Flash-Lite | 0.25–0.75 · … · 1.50–3.75 **V** | schema subset | unreliable measurement (R) | free tier used for training **V** | Not used |
| `gpt-5-mini` / `gpt-5-nano` | — | — | — | — | **Shutdown 2026-12-11 V** — avoid |

## 3. Text-to-speech

| | Azure standard neural | ElevenLabs Flash v2.5 / v4 Turbo | ElevenLabs v4 / v3 / Multilingual v2 | Google Neural2 | Google Chirp 3 HD | Google WaveNet | OpenAI gpt-4o-mini-tts / tts-1 | Cartesia Sonic 3.6 | Deepgram Aura-2 |
|---|---|---|---|---|---|---|---|---|---|
| $/1M chars | **15** (kanji ×2) **V** | 40 **V** | 80 **V** | 16 (1M free) **V** | 30 (1M free) **V** | 4 (4M free) **V** | ≈ $0.015/min (R) / 15 **V** | ≈ 39–50 **V** | 30 ($200 credit) **V** |
| Timing data | **viseme IDs + word boundaries V** (ja-JP docs conflict) | char alignment **V** | char alignment **V** | SSML marks **V** | none documented | marks (R) | none **V** | word + phoneme (lang coverage unverified) | not checked |
| Japanese reading control | phoneme (kana sapi/IPA), lexicon, sub **V** | alias dictionary; phoneme tags English-only model **V** | alias, inline IPA (v4) | yomigana phoneme **V** | phoneme (sync only) | yomigana | none | dictionary (English-oriented IPA) | — |
| Provider slow | `<prosody rate>` **V** | speed 0.7–1.2 (Flash) **V** | none on v4 **V** | speakingRate | speaking_rate **V** | speakingRate | speed (disputed) | 0.6–1.5 | — |
| Determinism | named voices; avoid HD "Latest" **V** | seed best-effort **V** | same | — | — | — | no seed; drift reported (R) | dated snapshots **V** | — |
| Data | **not stored V** | retained by default; ZRM enterprise-only **V** | same | not checked | not checked | not checked | 30-day abuse logs; models retire 2027-01-06 **V** | not checked | not checked |
| Plan / commercial | S0 PAYG; F0 0.5M free (dev) **V** | Starter $6 (commercial) **V**; Free non-commercial **V** | same | ✓ | ✓ | ✓ | ✓ + AI disclosure | Pro $5 | PAYG |
| **Role** | **Primary (provisional)** | Alternative if blind test win | Premium option | Alternative | Alternative | Budget floor | Not used | Optional test | Optional test |

## 4. Real-time speech-to-speech (comparison only)

| API | Price **V** | ≈ per 5-min session (E) | Why not for MVP |
|---|---|---|---|
| `gpt-realtime-2.1-mini` | audio in $10/1M tok, out $20/1M | $0.07–0.08 | no confidence gate, no visemes, weaker deterministic control |
| `gpt-realtime-2.1` | in $32/1M, out $64/1M | $0.22–0.24 | same + cost |
| GPT-Live 1 | $0.05/min session time incl. silence + backend | ≈ $0.26 | full duplex conflicts with tap-to-talk |
| Gemini 3.8 Live | ≈ $0.005/min in, $0.018/min out | ≈ $0.05–0.07 | free-tier data use; same control issues |

## 5. Avatar technology

| | Layered SVG + own controller | Rive | Lottie/dotLottie | Spine | Live2D | VRoid + three-vrm |
|---|---|---|---|---|---|---|
| Cost | $0 | Free export shows splash; Cadet ≈ $9/seat/mo annual ($17 monthly) to remove (docs conflict) **V** | creation tools paid/limited | $69+ editor + runtime licence **V** | free < ¥10M sales; per-title contract; Expandable-App clause **V** | free **V** |
| Runtime size | ≈ 5–8 KB controller | 314–849 KB gz wasm (measured) | 46–496 KB gz | + Pixi ≈ 237 KB gz | not measured | ≈ 220 KB gz + 5–20 MB model |
| Viseme control | direct group swap | state-machine inputs | segments/markers | attachments | mouth params | VRM aa/ih/ou/ee/oh |
| Fit | **Chosen** | Upgrade path | Rejected | Rejected | Rejected | Rejected |

## 6. Hosting & data

| | Cloud Run asia-south1 | Cloudflare Workers Paid + OpenNext | Vercel Hobby | Render Free | Fly.io | Supabase |
|---|---|---|---|---|---|---|
| Commercial use | ✓ | ✓ | **✗ non-commercial V** | "not for production" **V** | no free tier **V** | Free: not addressed; Pro $25 |
| Free tier | 180k vCPU-s, 360k GiB-s, 2M req/month **V** | Free: 10 ms CPU (unusable for SSR) **V**; Paid $5 incl. 10M req | — | 15-min spin-down | — | 500 MB DB, 1 GB storage, 5 GB egress, pause after 7 days, no backups **V** |
| Billing model | wall time while request open | CPU time; no egress fees **V** | — | — | — | — |
| Est. infra @ 1k / 10k MAU (engaged) | ≈ $13–19 / $44–61 compute (E) | ≈ $5 / $5–6 (E) | — | — | — | Pro $25 |
| Role | **Primary** | Scale alternative | Rejected | Rejected | Rejected | **Primary DB/Auth/Storage (Mumbai)** |
