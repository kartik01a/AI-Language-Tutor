# 17 — Risks, Open Decisions, Hypotheses & Limitations

> Related: [01 Decision register](01-product-requirements.md) · [16 Roadmap](16-implementation-roadmap.md) · [13 Gates](13-testing-and-evaluation.md)

This is the living register. Update it whenever a gate result, provider change or owner decision lands.

---

## 1. Risk register

Likelihood/Impact: H/M/L.

| ID | Risk | L | I | Mitigation | Owner phase |
|---|---|---|---|---|---|
| R-01 | Turn latency exceeds 2.5 s median from India (STT + LLM TTFT + TTS stack up to ~2–3 s) | M | H | Short first sentence; schema warm-up; warm pings; Fast mode; two-call comparison; measure in P0 | P0/P2 |
| R-02 | STT misrecognises Indian-accented learner Japanese/German → false "didn't catch that" loops or false corrections | H | H | Word-confidence gates, ASR-risk spans never corrected, calibrated thresholds, second-opinion STT, bake-off on our audio | P0/P2 |
| R-03 | STT "auto-corrects" learner grammar → real errors missed | H | M | Accept as the safe failure; neutral STT prompts; measure error preservation; pick STT partly on it | P0 |
| R-04 | LLM over-corrects / flags valid variants (incl. Indian English) | H | H | Taxonomy-limited minimal edits, 2/3 voting, deterministic gates, allowlist, verifier, report button + auto-disable | P3 |
| R-05 | No public benchmark for LLM correction of Japanese learner speech | H | M | In-house S5/S6 datasets with native teacher labels | P2/P3 |
| R-06 | Azure standard voices judged less natural than ElevenLabs → engagement drop | M | M | Blind test decision rule; ElevenLabs path costed ([12 §6](12-cost-and-performance-model.md)) | P0 |
| R-07 | ~~Azure ja-JP viseme events unavailable~~ ✅ **Resolved 2026-10-22: ja-JP, de-DE and en-US all return viseme events** ([measurements](research/notes/phase0-measurements.md)); fallbacks kept only as a safety net | – | – | – | done |
| R-08 | $50/month insufficient beyond ≈ 450–1,000 trial users/month or ≈ 100 engaged users | H | M | Kill switch; trial limit; WaveNet tier; waitlist gating; monetise before scaling | P2/P7 |
| R-09 | Supabase Free pauses/has no backups | M | H | Weekly dumps + keep-alive during beta; Pro ($25) at public launch | P4/P6 |
| R-10 | OpenAI model deprecations (fast cadence) break pinned models | H | M | Provider-neutral schemas; eval suite as regression; Haiku 5.5 failover | ongoing |
| R-11 | DPDP: Rule 8(3) one-year retention conflicts with account deletion promise | M | H | Interim split (content erased, minimal logs kept 1 year) + legal review | P6 |
| R-12 | CEFR descriptor copyright (Council of Europe) for commercial use | M | M | Original paraphrases only; legal check or permission before commercial launch | P4/P6 |
| R-13 | Minors use the service (DPDP children = under 18) | M | H | DOB gate, report channel, deletion procedure, legal review | P4 |
| R-14 | iOS Safari/PWA audio quirks (permission re-prompt, silent switch muting Web Audio, Bluetooth latency) | H | M | Single-route recorder, audioSession switching, lip-sync offset setting, device matrix | P2 |
| R-15 | Japanese reading errors (kuroshiro) → wrong furigana/TTS readings | M | M | Override dictionary, ambiguous-word list, SSML `<sub>`, voice corpus checks | P2 |
| R-16 | Cloud Run wall-time billing grows with conversation volume | M | L | Instance-based billing at scale; move `/turns` to a CPU-billed runtime if > $20/month | P7 |
| R-17 | Learner audio datasets hard to collect | M | M | Teacher-recorded learner-style items; small paid sessions; staged dataset growth | P0–P5 |
| R-18 | Tutor persona drift (tone/register inconsistent across turns) | M | M | Persona config, register rules, few-shots, naturalness ratings | P3 |
| R-19 | Abuse farming trial minutes | M | M | Google sign-in, IP-hash guard, rate limits, VAD gating, turn cap | P4 |
| R-21 | **Latency target missed in first real measurement:** time to first audio 4.6–6.6 s vs ≤ 2.5 s median (STT 1–2.5 s, LLM ≈ 3 s; measured from a laptop, not Mumbai); OpenAI shows a heavy latency tail (11–15 s outliers) | H | H | Hedged requests + schema warm-up (done); re-measure from asia-south1; options: Fast mode (2× price), spoken filler that claims no understanding, shorter analysis fields, alternative STT/LLM; keep streaming in reserve (saves only ≈ 0.3–0.5 s) | P0/P2 |
| R-20 | Solo-developer bandwidth | H | M | Strict MVP scope; phase gates; languages launch independently | all |

---

## 2. Open decisions

| ID | Decision | Options | Recommendation | Decide by |
|---|---|---|---|---|
| D-OPEN-01 | STT provider | Deepgram Nova-3 · Scribe v2 · Azure STT · gpt-transcribe | Deepgram (provisional) | P0 bake-off |
| D-OPEN-02 | Voice per character | Azure standard voices · ElevenLabs Flash/v4 Turbo · Google | Azure (provisional); buy ElevenLabs only on decisive blind-test win | P0 blind test |
| D-OPEN-03 | `UNCLEAR_MAX_RETRIES` default | ✅ **Resolved 2026-10-14: 1** (owner, following research: plain repeat ≈ 34% recovery vs "You can say" ≈ 57% / move on ≈ 64%) | — | done |
| D-OPEN-04 | English tutor accent | ✅ **Resolved 2026-10-14: American (en-US)** — blind test picks the specific en-US voice | — | P0 voice pick |
| D-OPEN-05 | German tutor address form | ✅ **Resolved 2026-10-14: du** in free conversation; Sie in formal topics | — | done |
| D-OPEN-06 | Default strictness | Balanced · Strict | Balanced (research: adults want more correction → test Strict as default) | P7 |
| D-OPEN-07 | Single-call vs two-call LLM | `POLICY_SINGLE_CALL` | Single-call unless misclassification or quality suffers | P2 |
| D-OPEN-08 | Classifier self-consistency (×3) | off · on | Off unless misclassification > 5% | P2 |
| D-OPEN-09 | Hosting at scale | Cloud Run · Workers Paid | Cloud Run until compute > $20/month | P7 |
| D-OPEN-10 | Japanese analyzer | kuroshiro 1.2 · kuroshiro 2.0 (beta) · Lindera UniDic | kuroshiro 1.2 + overrides; re-test 2.0 when stable | P2 |
| D-OPEN-11 | Brand name ✅ **Lactice**; logo and final tutor names still open | — | Owner | before public launch |
| D-OPEN-12 | Pricing & plan caps | ₹199/399/799 with minute caps | Decide from waitlist data + usage | P7 |

---

## 3. Unvalidated hypotheses (must be measured)

| ID | Hypothesis | How we test |
|---|---|---|
| H-01 | Word-confidence thresholds can separate misrecognised words for Indian learners in ja/de/en | P0/P2 calibration plots |
| H-02 | Analysis-first streamed JSON keeps p50 ≤ 2.5 s | P2 traces |
| H-03 | 2/3 edit voting + gates achieve ≤ 5% false-positive cards | P3 S5/S6 evals |
| H-04 | 10 s / 25 s silence thresholds feel right for A1–B2 | P7 A/B, per-level tuning |
| H-05 | Learners understand and use correction cards and "Try again" | P1 WoZ, P7 analytics |
| H-06 | The per-skill level estimate tracks teacher ratings within ±1 band | P5/P7 S8 |
| H-07 | Tap-to-talk feels natural enough (vs hands-free) for this audience | P1/P7 interviews |
| H-08 | Azure standard voices are bit-identical/stable across calls | P0 determinism test |
| H-09 | Indian adult learners prefer explicit, rule-referenced feedback | P7 preference test |
| H-10 | Trial users convert to waitlist and state a viable price | P7 waitlist data |

---

## 4. Deferred decisions (safe to decide during implementation)

Exact XState vs reducer choice; Serwist vs Workbox; PostHog EU vs US cloud; topic background illustrations; exact can-do item wording (after legal check); admin page styling; dashboard chart choices; Rive upgrade timing.

---

## 5. Known limitations (accepted for MVP)

- Speaking-only: no typing fallback (D-28) — excludes learners who can't speak aloud.
- Turn-based latency (1.5–3 s), not phone-call speed.
- No pronunciation scoring; "didn't catch that" is the only pronunciation signal.
- Level is an estimate, never a certification; JLPT/Goethe results are not speaking evidence.
- Corrections favour precision over recall: some real errors (especially ones the STT normalises away) will be missed.
- English explanations for all tracks (Hindi translations only on the English track); English track starts at A2.
- Voice quality bound to the chosen provider's stock voices; switching provider changes the character's voice.

---

## 6. Risks that must be addressed before public launch

1. R-02/R-04: correction precision and ASR gating proven on each live language (G2/G3).
2. R-11/R-13/R-12: legal review of DPDP retention, age gate and CEFR paraphrases.
3. R-09: Supabase Pro + restore test.
4. R-08: budget behaviour proven with the kill switch in staging; spend caps verified.
5. R-14: device matrix pass on iPhone (tab + PWA) and mid-range Android.
