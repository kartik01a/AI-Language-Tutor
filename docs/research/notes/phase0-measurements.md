# Phase 0 measurements (real providers)

> Measured 2026-10-22 from a developer laptop in India (NOT from the Mumbai Cloud Run region), with the
> real Deepgram, OpenAI and Azure keys. Scripts: `scripts/probe-*.mjs`, `scripts/real-session.mjs`,
> `scripts/eval-corrections.mjs`. **The "learner" audio is synthetic (Azure voices): it validates plumbing and
> LLM behaviour, not real learner speech.** Every number below must be re-measured on recorded Indian
> learners (docs/13 S1–S6) and from the deployed region before it is treated as a release gate.

## Resolved unknowns

| Question (docs ref) | Result |
|---|---|
| Does Azure return viseme events for **ja-JP**? (R-07, 05 §4.3) | **Yes.** Standard neural voices return visemes for ja-JP (39 events for one sentence, 8 of our 10 shapes), de-DE (28) and en-US (27). The word-boundary/kana fallback is only a fallback now. |
| Does `gpt-6-luna` accept strict schemas with effort `none`? | **Yes.** All five strict schemas are accepted; responses validate against the Zod schemas. |
| Does Deepgram hallucinate on silence/tone? | Not in the 2 cases tried (empty transcripts). Too few cases to conclude; test on real noise (S2). |
| Deepgram confidence on clean speech | ≈ 1.0 on synthetic speech — carries no calibration information. Needs real learner audio (S1). |

## Latency (single machine, not Mumbai)

| Stage | Observed | Plan target |
|---|---|---|
| Azure TTS, one short sentence (new connection each call) | 0.7–1.4 s | ≤ 0.3 s first byte (vendor claim) |
| Deepgram STT, 2–4 s clip | 0.5–2.6 s | 0.4–0.8 s |
| `gpt-6-luna` turn call, effort none, complete JSON | 2.6–4.7 s (streaming: first text ≈ 1.4 s after request, of which ≈ 1.0 s before response headers) | TTFT 0.7–0.95 s |
| **Time to first tutor audio** (full pipeline, 3 sentences, parallel TTS) | **4.6–6.6 s** | median ≤ 2.5 s |

Findings: (1) the 2.5 s median target is **not met** in this setup — the largest costs are STT (1–2.5 s) and the LLM
call (≈ 3 s); streaming the reply would save only ≈ 0.3–0.5 s because outputs are short; (2) OpenAI latency has a heavy
tail (11.7 s and a 15 s timeout seen) → hedged requests + startup schema warm-up added; (3) must re-measure from
`asia-south1`; if still > 3.5 s median, options are Fast mode (2× price), a spoken filler ("えーと…") that makes no claim
of understanding, shorter analysis fields, or a faster STT/LLM pairing.

## Prompt caching
The turn prompt is ≈ 940 tokens, below OpenAI's 1,024-token cache minimum: **no cache hits**, so docs/12's
cached-input discount does not apply yet (cost is slightly higher than modelled, but small in absolute terms).

## Correction pipeline (synthetic voice → real Deepgram → real `gpt-6-luna`; 8 error + 12 valid sentences, A2, Balanced)

| Detection effort | Recall | False-correction rate (valid) | Card precision |
|---|---|---|---|
| `none` | 50% (4/8) | 0% (0/12) | 100% |
| **`low` (default)** | **88% (7/8)** | **0% (0/12)** | **100%** |
| `medium` | 88% (7/8) | 0% (0/12) | 100% |

Gates (docs/13 §4.2): false-correction ≤ 5% and precision ≥ 90% are met on this tiny clean set; **that is a baseline, not
evidence** (n=20, synthetic audio, no ASR-error cases). Remaining miss: い-adjective past (おもしろいでした).

Bugs found only by the real run (all fixed, with regression tests): (a) detector spans too wide → a shaky *neighbour* word
blocked a genuine particle correction; (b) samples with different span widths split the vote; (c) tense error flagged by
1/3 samples at effort none; (d) the summary verifier judged corrections without the sentence and rejected genuine ones —
with the full sentence it confirms genuine corrections **and rejects a deliberately false one**.

## Cost (3-turn real session incl. greeting, corrections, summary)
≈ **$0.0055** total ($0.0011–0.0017 per learner turn incl. STT + LLM + TTS + corrections). A 10-turn session extrapolates to
≈ $0.02, below the $0.05 modelled in docs/12 — but effort `low` detection adds reasoning tokens and caching is inactive;
re-measure over ≥ 50 real sessions before changing the budget model.

## First real-user attempt: a clear self-introduction was rejected (2026-10-22)
User said 「こんにちは、カーティクです」; Deepgram heard 「こんにちは、カルテックです。」 at 0.90 mean confidence (all gates passed),
but the turn was shown as "I couldn't catch this". Root causes, both in our code/prompt, neither in speech recognition:
1. **Model inconsistency on names:** the identical input was classified `understood` in ~2/3 of runs and `partially_understood`
   in ~1/3, because a name can't be verified. Fix: the prompt now says names/places/loanwords are accepted as heard and
   `partially_understood` is only for genuine meaning uncertainty. After the fix: 10/10 and 6/6 `understood` on two names;
   deliberately garbled-but-confident words are still 6/6 `partially_understood`.
2. **Throwing away the model's own clarification:** when the model *was* unsure, its targeted confirmation question
   (「カルテック」はお名前ですか？) was discarded in favour of the generic "say it again" template, and the transcript was
   hidden even though recognition was confident. Now the model's single, validated confirmation question is spoken and the
   transcript is shown. The model's reply is used **only** when the model itself was unsure — never when code downgraded an
   "understood" answer (that reply assumed understanding).
Also added: dev-only per-turn diagnostics (reason, heard text, confidence, speech duration) and a structured `[turn]` log.
Note for later: accented speech does produce low word confidence (0.37–0.65 on Indian-accented synthetic voices), so the
provisional 0.70 mean-confidence gate will need calibration on real learners; the planned "Did you say …? Yes/No" confirmation
flow is the intended answer for that mid-confidence zone.
