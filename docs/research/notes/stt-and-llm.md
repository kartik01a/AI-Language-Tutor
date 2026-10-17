# STT and LLM research: AI voice language tutor

**Prepared:** 2026-10-14 (all sources accessed 2026-10-14).
**Scope:** Speech-to-text (STT) and LLM choices for a turn-based, tap-to-talk tutor (Japanese and German at CEFR A1–B2, English at A2–B2; Indian adult learners), on a budget of about $50/month for AI and infra.

**Evidence labels**
- **VERIFIED**: read on an official or primary source page (vendor docs, pricing page, paper abstract).
- **REPORTED**: from a secondary source (press, blog, third-party benchmark, forum).
- **ESTIMATE / ASSUMPTION**: my own calculation or an assumption, with the inputs shown.

Source numbers such as [S1] refer to the Sources list at the end.

---

## 0. Key findings in brief

1. **OpenAI's STT line-up changed in July and August 2026.** The recommended model is now `gpt-transcribe` at $0.0045/min, with `gpt-live-transcribe` at $0.017/min for streaming. `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` and `gpt-4o-transcribe-diarize` are **deprecated and shut down on 2027-02-26** (VERIFIED [S1][S5][S6]).
2. **The new OpenAI STT models return no confidence signal.** Token `logprobs` are available only on the deprecated `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` (VERIFIED [S3]). The docs state that `gpt-live-transcribe` returns no confidence scores (VERIFIED [S4]). `gpt-transcribe` returns only a detected-`languages` array, which is empty when detection is unreliable (VERIFIED [S2][S3]). This matters directly for the core "never invent meaning" requirement.
3. **Confidence signals are available elsewhere.** ElevenLabs Scribe v2 returns per-word `logprob` plus `language_probability` at $0.22/hour, about $0.0037/min (VERIFIED [S20][S21]). Deepgram Nova-3 returns per-word and per-alternative `confidence` (VERIFIED [S17][S19]). Whisper-style `verbose_json` returns segment `avg_logprob`, `no_speech_prob` and `compression_ratio`; this is available on Groq for whisper-large-v3 at $0.111/hour with a 10-second minimum bill per request (VERIFIED [S22]).
4. **The current OpenAI cheap LLM is `gpt-6-luna`** (released 2026-09-22). It costs $0.10 input, $0.01 cached input, $0.125 cache write and $0.50 output per 1M tokens. It supports `reasoning.effort: none`, strict Structured Outputs and streaming (VERIFIED [S1][S7][S5]). `gpt-5-mini` and `gpt-5-nano` snapshots shut down on 2026-12-11 (VERIFIED [S6]).
5. **Reasoning effort dominates latency.** Artificial Analysis measures `gpt-6-luna` time-to-first-token at about 0.74–0.94 s with no reasoning, versus about 1.6–2.6 s at `low` (REPORTED; the figures differ between page snapshots [S27][S28]). Only `none` fits a 1.5–3 s end-to-end target once STT and TTS are added.
6. **Cost is not the constraint for STT and the LLM.** The recommended pipeline (`gpt-transcribe` + `gpt-6-luna`) costs about **$0.011 per 5-minute session, or about $0.0023 per minute** (ESTIMATE, §8). Speech-to-speech alternatives cost about 6× to 23× more. TTS, which is outside this report's scope, will probably cost more per session than STT and the LLM combined.
7. **ASR also hides learner errors.** A 2025 study of Japanese learners' spontaneous English (ICNALE corpus) found Whisper, Google STT and Rev AI all "auto-correct" wrong verb and noun forms, Whisper most strongly (REPORTED via the J-STAGE abstract [S33]). The tutor therefore risks *missing* real errors as well as inventing ones the learner didn't make.
8. **Text-to-speech is also being deprecated (outside scope, but a risk).** OpenAI is retiring `tts-1`, `tts-1-hd` and the `gpt-4o-mini-tts` snapshots on 2027-01-06, with `gpt-realtime-2.1-mini` named as the replacement (VERIFIED [S6]).

---

## 1. OpenAI speech-to-text models (Q1)

### 1.1 Models and prices

| Model | Status | Price | Confidence signal | Notes |
|---|---|---|---|---|
| `gpt-transcribe` | Current; recommended. Released 2026-07-28 | **$0.0045/min** | **None** (detected `languages` array only) | Accepts `prompt`, `keywords[]` and `languages[]`. Supports file streaming (`stream=true`) and committed turns in Realtime sessions. |
| `gpt-live-transcribe` | Current. Released 2026-07-28 | **$0.017/min** | **None.** Docs: no word timestamps, speaker labels or confidence scores | Realtime/WebSocket streaming with tunable `delay` (minimal/medium/high/xhigh). No server VAD; you commit turns from the client. |
| `gpt-realtime-whisper` | Current | $0.017/min | Not checked | Live transcription |
| `gpt-4o-transcribe` | **Deprecated; shutdown 2027-02-26** | $2.50/1M input, $10/1M output; ~$0.006/min | **Token logprobs** (`include[]=logprobs`, json only) | Accepts `prompt` and `language` |
| `gpt-4o-mini-transcribe` (+ `-2025-12-15` snapshot) | **Deprecated; shutdown 2027-02-26** | $1.25/1M input, $5/1M output; ~$0.003/min | **Token logprobs** | Accepts `prompt` and `language` |
| `whisper-1` | **Deprecated; shutdown 2027-02-26** | $0.006/min | `verbose_json` segments: `avg_logprob`, `no_speech_prob`, `compression_ratio` | `prompt` limited to 224 tokens. Only model with word timestamps. No streaming. |
| `gpt-4o-transcribe-diarize` | **Deprecated; shutdown 2027-02-26** | ~$0.006/min | No logprobs; no prompt | Speaker labels |

All rows are VERIFIED from [S1] (pricing), [S2] (speech-to-text guide), [S3] (API reference), [S4] (realtime transcription guide), [S5] (changelog) and [S6] (deprecations).

### 1.2 Request details for our use case (VERIFIED [S2][S3])

- **Input formats:** `flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm` [S3]. The guide's shorter list includes `mp4`, `m4a` and `webm` [S2].
  - Chrome's `audio/webm;codecs=opus` and iOS Safari's `audio/mp4` (AAC) are both accepted containers.
  - The reference says the request "must include enough format metadata for the file to be identified". Send a filename with the correct extension (`.webm` or `.mp4`/`.m4a`) and a matching content type.
- **Max file size:** 25 MB. A 15-second Opus clip is well under 1 MB.
- **Language hints:**
  - `language` (single ISO-639-1 code) works for the older models.
  - `gpt-transcribe` uses `languages[]` instead, and you must not send both.
  - The API rejects unsupported codes.
- **`prompt`:** "should match the audio language". `gpt-4o-transcribe-diarize` does not support it.
- **`keywords[]`** (`gpt-transcribe` only): the docs warn that keywords are hints and to check that they don't cause **unspoken terms to appear**. This is relevant to hallucination.
- **`temperature`:** 0–1. At 0 the model "will use log probability to automatically increase the temperature until certain thresholds are hit".
- **`chunking_strategy`:** server-side VAD chunking (`auto` or `server_vad`). It is not needed for 2–15 s tap-to-talk clips.
- **Streaming of a completed file:** `stream=true` emits `transcript.text.delta` events and a final `transcript.text.done`. For the deprecated 4o models, deltas carry logprobs.

### 1.3 Latency for short clips

- **Not published by OpenAI for short clips.** ESTIMATE.
- REPORTED: The Decoder says `gpt-transcribe` processes files about 34× faster than real time [S30]. Artificial Analysis gives a speed factor of 56.8 for GPT Transcribe and 36.9 for GPT-4o Transcribe [S29]. However, AA measures on 10-minute files and warns that short-clip speed differs [S31].
- OpenRouter lists about 0.77 s P50 latency for `gpt-4o-mini-transcribe`, with clip length unspecified (REPORTED [S31]).
- **ESTIMATE:** expect about 0.4–1.0 s round trip from India for a 5–10 s clip. Most of that is network and queueing overhead, not compute.
- **Action:** benchmark P50 and P95 from an Indian network before committing. Also try OpenAI regional processing (see §6).

---

## 2. STT accuracy evidence: Japanese, German, Indian-accented and non-native speech (Q2)

| Evidence | Japanese | German | Hindi / Indian | Source / label |
|---|---|---|---|---|
| FLEURS, Mistral's Voxtral Realtime paper (Table 7) | Whisper **4.97% CER**; GPT-4o mini Transcribe **9.89% CER**; Scribe v2 Realtime 10.92% CER; Voxtral Mini Transcribe V2 4.14% CER | Whisper 5.46; GPT-4o mini 4.07; Scribe v2 RT 4.31; Voxtral V2 3.54 (WER %) | Hindi WER: Whisper 28.87; GPT-4o mini 8.39; Scribe v2 RT 12.62 | REPORTED [S32]. Written by a competitor (Mistral). "Whisper" variant not specified in the extracted table. |
| OpenAI launch benchmark for `gpt-transcribe` | Common Voice, 22 languages: WER **19.27%** vs **40.37%** for whisper-1 (aggregate only, no per-language figures) | — | — | REPORTED [S30][S34]. I did not find OpenAI's own launch page. |
| Artificial Analysis AA-WER (English only; agent talk, VoxPopuli, Earnings22) | — | — | — | REPORTED [S29]: Scribe v2 2.2%, Gemini 3.5 Transcribe 2.6%, **GPT Transcribe 3.3%**, GPT-4o Transcribe 4.0%, Chirp 3 4.3%, GPT-4o mini Transcribe 4.5%, Groq Whisper v3 Turbo 4.6%, Deepgram Nova-3 5.2% |
| Non-native English (L2-ARCTIC, includes Hindi-L1 speakers) | — | — | Whisper and AssemblyAI best on read speech (MER 0.054 / 0.056); RevAI best on spontaneous speech (MER 0.063) | REPORTED [S35] (arXiv 2503.06924) |
| Japanese learners' spontaneous English (ICNALE, 214 files) | Whisper best of Google, Rev AI and Whisper: **WER 28.7%** (pruned) / **18.8%** (pruned-normalised). All three had higher WER for non-native than native speakers. **All three auto-corrected erroneous verb and noun morphology; Whisper most strongly.** | — | — | REPORTED [S33] (Koizumi 2025, *LET Journal of Central Japan* 35:15–30) |

**Takeaways and gaps**

- **No vendor publishes Japanese or German learner-speech accuracy.** There is also no verified per-language FLEURS figure yet for `gpt-transcribe`.
- **The one independent table we found is mixed for OpenAI on Japanese.** In the Mistral paper, the LLM-based GPT-4o mini Transcribe was roughly 2× worse on Japanese CER than Whisper. Treat this as a reason to test, not as a conclusion.
- **Auto-correction is the important learner-specific effect.** Modern ASR tends to normalise ungrammatical L2 speech to the intended form. For a tutor, that turns "invented errors" into "missed errors". Missing an error is the safer direction for our core rule, but it weakens feedback.
- **Action (ESTIMATE of effort, about 1–2 days):** build a 60–100 clip in-house test set. Cover Indian learners speaking Japanese, German and English at A1–B2, including deliberately wrong forms (e.g. 「わたしは学生がです」, "Ich habe gegangen", "He go to school"), silence clips and noisy clips. Score candidate STTs on (a) CER/WER, (b) **error preservation**, and (c) phantom output on silence.

---

## 3. STT hallucination on silence, noise and short clips; mitigations (Q3)

### 3.1 Evidence

- **"Careless Whisper: Speech-to-Text Hallucination Harms"** (Koenecke, Choi, Mei, Schellmann, Sloane; ACM FAccT 2024, DOI 10.1145/3630106.3658996; arXiv 2402.08021) (VERIFIED abstract [S36]):
  - About **1%** of Whisper transcriptions contained entire hallucinated phrases or sentences.
  - **38%** of hallucinations contained explicit harms.
  - Hallucinations occur disproportionately for speakers with **longer non-vocal durations**. This is relevant to hesitant beginners who pause a lot.
- **Japanese phantom phrases.** whisper-1 outputs 「ご視聴ありがとうございました」, 「チャンネル登録よろしくお願いします」 and 「本日はご覧いただきありがとうございます」 on silence, quiet audio and **2–3 s clips**. One report saw a loop repeated 69 times in a 27-minute file (REPORTED: Zenn, 2026-04-08 [S37]; Qiita [S38]; GitHub issue [S39]). Developers attribute this to YouTube-subtitle training data (REPORTED).
- **gpt-4o-transcribe family.** One developer re-ran six Japanese files (including 2.7 s and 25 s clips) that made whisper-1 hallucinate, and gpt-4o-transcribe produced **no phantom phrases** (REPORTED, small sample [S37]).
- **Other gpt-4o-transcribe reports** (REPORTED [S40]):
  - Drift into **translation** with mixed Spanish/English audio.
  - Unreliable language enforcement.
  - Better described as "semantic" than verbatim.
  - These are relevant when Indian learners mix English into Japanese or German answers.
- **No published hallucination rate for `gpt-transcribe` or `gpt-live-transcribe`** (not found).
- **Speech-to-speech:** OpenAI says `gpt-realtime-2.1` improved "silence and noise handling" (VERIFIED changelog [S5]; no metric given).

### 3.2 Signals each API actually exposes

| Provider / model | Silence / no-speech signal | Per-token or per-word confidence | Language-ID confidence |
|---|---|---|---|
| OpenAI `gpt-transcribe` | None | **None** | `languages: []` when unreliable (VERIFIED) |
| OpenAI `gpt-live-transcribe` | None | **None** (VERIFIED) | None |
| OpenAI `gpt-4o(-mini)-transcribe` (until 2027-02-26) | None | Token `logprob` (VERIFIED) | — |
| OpenAI `whisper-1` (until 2027-02-26) | Segment `no_speech_prob` | Segment `avg_logprob`, `compression_ratio` (VERIFIED) | — |
| Groq `whisper-large-v3` / `-turbo` | `verbose_json` supported (VERIFIED). Field set assumed to match Whisper (REPORTED/ASSUMPTION; test it) | Segment-level, plus word timestamps | — |
| ElevenLabs Scribe v2 | `audio_event` tagging (`tag_audio_events`) | **Per-word `logprob`** (VERIFIED) | **`language_probability`** (VERIFIED) |
| Deepgram Nova-3 | — | **Per-word and per-alternative `confidence`** (VERIFIED field; undocumented semantics) | — |
| Azure Speech | — | NBest `Confidence`; word-level with `wordLevelConfidence` (REPORTED [S26]) | — |
| Google STT / Gemini 3.5 Transcribe | Not verified | Not verified | Not verified |

**Official-doc oddity (VERIFIED [S3]):** the OpenAI reference says to treat a segment as silent if "`no_speech_prob` is higher than **1.0** and `avg_logprob` is below -1". A probability can never exceed 1.0. Practitioners use `no_speech_prob > 0.6` **and** `avg_logprob < -1.0`, for example the Qiita write-up [S38] (REPORTED). Calibrate on your own audio.

### 3.3 Recommended mitigation stack (ASSUMPTION thresholds; tune on the test set)

1. **Client-side VAD gate before upload.** Run Silero VAD (ONNX in the browser) or WebRTC VAD.
   - Reject the clip and show "I didn't hear anything, tap and try again" if voiced speech is under about **300–500 ms**, or the clip is under about **0.8 s** total.
   - Trim leading and trailing silence; Qiita [S38] trims leading silence of 5 s or more.
   - This removes the main whisper-style trigger (silence or very short clips) at zero cost.
2. **Level and SNR check.** Warn on clipping or a very low RMS level instead of sending the clip.
3. **Constrain the language.** Pass `languages: ["ja","en"]` (or `["de","en"]`, `["en","hi"]`) so English code-switching is still transcribed, not translated. Treat `languages: []`, or a detected language outside the expected set, as "uncertain".
4. **Use a neutral prompt.** Never put the *expected answer* in the STT `prompt` or `keywords`: it biases the output toward the correct sentence, masking errors and fabricating fluent text. Use something like "Verbatim transcript of a language learner. Keep grammatical mistakes, hesitations and repetitions." Whether this preserves errors is untested; run the test set.
5. **Blacklist phantom phrases.** Drop or flag outputs matching known phrases (ご視聴ありがとうございました, チャンネル登録…, "Thank you for watching", "you", "bye"; [S38]). Also flag repetition loops and script mismatch, such as Latin-only output for Japanese audio (Qiita's three-layer approach [S38]).
6. **Threshold the confidence signal where one exists.** Examples: Scribe word `logprob`, Deepgram `confidence`, Whisper-style `avg_logprob`/`no_speech_prob`, or 4o-transcribe token logprobs. Pass **per-word confidence into the LLM prompt**, e.g. `"わたし(0.98) は(0.97) がくせい(0.41)"`.
7. **Tutor-side policy (enforced by the state machine, not just the prompt).**
   - The JSON schema has `understanding: "clear" | "partial" | "unclear"`.
   - If STT confidence is low or the transcript is empty or blacklisted, the state machine forces `unclear`. The tutor then asks the learner to repeat instead of correcting.
   - Corrections may only target tokens above the confidence threshold.
   - Show the transcript ("I heard: …") with a "That's not what I said" button.
8. **Optional second opinion.** On low-confidence clips only, run a second STT (e.g. Groq Whisper at about $0.0003 per 10 s clip). Treat disagreement as "unclear".

---

## 4. Alternative STT providers (Q4)

| Provider / model | Price (batch, pay-as-you-go) | Japanese | German | en-IN | Confidence | Data retention / training | Label |
|---|---|---|---|---|---|---|---|
| **OpenAI `gpt-transcribe`** | $0.0045/min | Yes (languages list) | Yes | Accent not specified | **None** | No training by default. Transcriptions endpoint: abuse-monitoring retention "None", application state "None", ZDR-eligible. | VERIFIED [S1][S8] |
| **ElevenLabs Scribe v2** | $0.22/hr (**$0.0037/min**); keyterms +$0.05/hr; Realtime $0.39/hr | Yes (auto-detect or `language_code`) | Yes | — | **Word logprob + language probability** | `enable_logging=false` gives zero retention, **enterprise only**. Training policy not verified. | VERIFIED [S20][S21] |
| **Deepgram Nova-3** | Pre-recorded: mono $0.0043/min, multi $0.0052/min. Streaming: mono $0.0048, multi $0.0058 (promo). **$200 free credit.** | Yes (`ja`, mono and `multi`) | Yes | **`en-IN` listed** | **Word + alternative confidence** | Model Improvement Program: opt out per request with `mip_opt_out=true`. The default appears to be opt-in (REPORTED). | VERIFIED [S17][S18][S19] |
| **Groq Whisper large-v3 / v3-turbo** | $0.111/hr / $0.04/hr; **10 s minimum billed per request** | Whisper multilingual | Yes | — | Whisper `verbose_json` | No retention by default; up to 30-day logs for reliability/abuse, can opt out. | VERIFIED [S22][S23] |
| **Google Cloud STT V2 (Chirp)** | Standard $0.016/min (0–500k min); dynamic batch $0.003/min; billed per 1 s | Yes | Yes | Yes | Not verified | Data-logging tier option | VERIFIED price [S24]. AA: Chirp 3 at 4.3% English WER (REPORTED [S29]). |
| **Gemini 3.5 Transcribe** (Gemini API) | ~$0.005/min blended (audio $2/1M, text $12/1M) | Auto language detection | — | — | Not verified | Paid tier: not used to improve products. Free tier: **used**. | VERIFIED [S13] |
| **Azure Speech** | S1 real-time **$1.00/hr** ($0.0167/min); Fast Transcription $0.36/hr (promo $0.10/hr); batch $0.18/hr. **Free F0: 5 audio hours/month.** "Enhanced feature audio" add-on $0.30/hr (assumed to cover pronunciation assessment; ASSUMPTION). | Yes | Yes | Yes | NBest + word confidence (REPORTED [S26]) | Not checked | VERIFIED price via Azure Retail Prices API, Central India [S25]; free tier [S25b] |

**Azure pronunciation assessment (future option), VERIFIED [S26b]:** 33 locales, including **ja-JP, de-DE, en-IN, hi-IN**, en-US and en-GB. It provides accuracy, fluency and miscue assessment.

**Japanese quality across providers:** No verified head-to-head on learner Japanese. The only independent table (FLEURS, §2) favours Whisper and Voxtral over GPT-4o mini and Scribe v2 Realtime on Japanese CER. That is not decisive for learner speech.

---

## 5. LLMs for the tutor turn (Q5)

### 5.1 OpenAI (VERIFIED [S1][S7][S5][S9][S10])

| Model | Input / Cached / Cache write / Output (per 1M, Standard, ≤272K) | Reasoning effort | Notes |
|---|---|---|---|
| **`gpt-6-luna`** (2026-09-22) | **$0.10 / $0.01 / $0.125 / $0.50** | none, low, **medium (default)**, high, xhigh, max | "Most efficient model for focused, high-volume tasks". 1.05M context; May 2026 knowledge cutoff. Chat Completions function calling only with effort `none`. EU residency including Fast mode. **Fast mode = 2× price; Batch/Flex = 50%.** |
| `gpt-6-sol` | $2 / $0.20 / $2.50 / $10 | supports `none` | Mid tier |
| `gpt-6.1-sol` (2026-09-29) | $2 / $0.10 / $2.50 / $10 | low…max (**no `none`**) | Near-Astra quality |
| `gpt-6-astra` | $10 / $1 / $12.50 / $50 | no `none` | Flagship; no logprobs, temperature or top_p |
| `gpt-5.6-luna` | $0.20 / $0.02 / $0.25 / $1.20 | none…max | Previous generation |
| `gpt-5.4-mini` / `gpt-5.4-nano` | $0.75 / $0.075 / – / $4.50; $0.20 / $0.02 / – / $1.25 | — | 5.4-nano shuts down 2027-04-01 |
| `gpt-5-mini` / `gpt-5-nano` | $0.25 / $0.025 / – / $2.00; $0.05 / $0.005 / – / $0.40 | — | **Snapshots shut down 2026-12-11.** Do not build on them. |

- **Strict Structured Outputs** (`text.format: {type: "json_schema", strict: true}`):
  - Supported on `gpt-6-luna` and the GPT-6 family (VERIFIED [S7][S10]).
  - Keys are emitted **in schema order**, so put `understanding` and `reply_text` first to stream TTS early.
  - Limits: 5,000 properties, 10 nesting levels, 1,000 enum values.
  - The **first request with a new schema has extra latency**, so warm it at deploy time (VERIFIED [S10]).
- **Prompt caching (GPT-5.6 and later)** (VERIFIED [S11]):
  - Minimum 1,024 tokens. Cache writes cost **1.25×** input; reads cost 0.1× (0.05× on 6.1 Sol).
  - TTL is at least 30 min after the last write or reuse.
  - Use `prompt_cache_options.mode: "explicit"` with a breakpoint after the static system prompt. This avoids paying write fees on per-turn content.
  - Cache hit rate drops if traffic to one prefix exceeds about 15 requests per minute (overflow routing).
- **Decisions API (beta, 2026-10-06, `gpt-6-luna` only)** (VERIFIED [S12]):
  - Returns typed `predicate` probabilities, `choice` with confidence, and `score`, "about 10× faster than the Responses API".
  - A candidate for the *understanding classification* step, e.g. "Does the transcript answer the prompt?" as a probability. It cannot generate reply text.
  - Pricing is not stated in the guide I read; check before use.
- **Latency.** ESTIMATE: tutor-call TTFT about 0.8–1.0 s at effort `none`. Inputs (REPORTED, Artificial Analysis, live-measured and fluctuating [S27][S28]):

  | `gpt-6-luna` setting | Time to first token | Output speed |
  |---|---|---|
  | No reasoning | 0.94 s (page fetch); 0.74 s (search snapshot) | ~112–131 tok/s |
  | `low` | 2.64 s (page); 1.59 s (snapshot) | — |
  | `medium` | ~5.3 s (snapshot) | — |
- **OpenAI guidance:** "use `low` for latency-sensitive workloads" and `none` as the latency baseline (VERIFIED [S9]).
- **Recommendation:** use `none` for the 12 tutor turns and `low` or `medium` for the end-of-session analysis call. Fast mode (2× price) is an option if P95 latency is too high.
- **Safety identifier:** for end-user apps OpenAI asks you to send a stable, privacy-preserving `safety_identifier` (VERIFIED [S9]). Use a hashed user ID.

### 5.2 DeepSeek (VERIFIED [S14][S15][S16])

- **Models:**
  - `deepseek-flash` (DeepSeek-V4.1-Flash) and `deepseek-v4-pro` (DeepSeek-V4-Pro-0813).
  - 1M context. Legacy `deepseek-v4-flash` names are now served by V4.1-Flash.
- **Flash prices per 1M tokens:**

  | | Peak | Off-peak (50%) |
  |---|---|---|
  | Cache hit | $0.006 | $0.003 |
  | Cache miss | $0.30 | $0.15 |
  | Output | $1.20 | $0.60 |

- **Peak hours:** 01:00–04:00 and 06:00–10:00 UTC on weekdays, i.e. 06:30–09:30 and 11:30–15:30 IST. Indian evening study hours fall **off-peak**.
- **Structured output:** only `response_format: {type: "json_object"}` ("valid JSON", **not schema-enforced**). You must include the word "json" in the prompt. The docs warn the API "may occasionally return empty content". No strict mode is documented.
- **Thinking mode is on by default (effort `high`).** Disable it with `{"thinking":{"type":"disabled"}}` or `reasoning.effort: "none"` for latency.
- **Data and privacy:**
  - Operator: Hangzhou DeepSeek AI. Terms are governed by PRC law (Open Platform ToS, effective 2026-04-29).
  - The privacy policy (updated 2026-02-10) says DeepSeek stores personal data "in People's Republic of China".
  - It lists "User Input" as used "to train and improve our technology", with an opt-out right.
  - The Open Platform ToS **does not address** whether API inputs are used for training, retention, or storage location.
  - **Conclusion:** no contractual "no-training on API data" guarantee was found. This is weaker than OpenAI, Google paid or Anthropic for DPDP posture.

### 5.3 Google Gemini (VERIFIED [S13][S13b][S13c])

- **Prices per 1M tokens (paid tier):**

  | Model | Input | Cached | Output |
  |---|---|---|---|
  | `gemini-3.8-flash` | $0.75 (**rises to $1.50 on 2027-01-01**) | $0.075 | $3.75 (rises to $7.50) |
  | `gemini-3.5-flash-lite` | $0.30 | $0.03 | $2.50 |
  | `gemini-3.1-flash-lite` | $0.25 text | $0.025 | $1.50 |

- **Data use:**
  - The **free tier is "Used to improve our products: Yes"**, and the terms allow human reviewers to read free-tier input and output.
  - The paid tier is not used to improve products, but prompts are logged "for a limited period" for abuse detection.
  - The API requires users to be 18 or older.
  - **Do not use the free tier for learner audio or text.**
- **Structured output:** `response_format` with `mime_type: "application/json"` and a `schema` (a JSON Schema subset). The docs advise validating results; there is no explicit conformance guarantee.
- **Latency:** an Artificial Analysis snapshot showed about 10–11 s TTFT for 3.5 Flash-Lite, probably with thinking on (REPORTED [S28b], unreliable). Measure before use.

### 5.4 Anthropic Claude Haiku (VERIFIED [S41][S42])

- **Claude Haiku 5.5** prices per 1M tokens:
  - Input: $0.10 (prompts ≤100K tokens).
  - Output: $0.50.
  - Cache write: $0.125 (5-minute TTL) or $0.20 (1-hour TTL).
  - Cache hit: $0.01.
- This is identical to `gpt-6-luna` on our workload.
- Claude Haiku 4.5 costs $1 input / $5 output.
- **Data:** Anthropic does not use commercial or API inputs and outputs for training by default. Feedback you submit is an exception.
- **Latency:** no verified TTFT figure was found.

### 5.5 Japanese and German quality

**No verified per-language benchmark was found** for `gpt-6-luna`, Haiku 5.5, `deepseek-flash` or Gemini Flash-Lite in Japanese or German. MMLU-ProX covers both languages and reports large drops for low-resource languages, but I found no scores for these models [S43] (REPORTED).

**Action:** run a 50-item rubric eval comparing `gpt-6-luna` (none) vs Haiku 5.5 vs `gpt-6-sol` on two kinds of item:
- correct error identification in learner Japanese and German, measuring false-positive corrections;
- natural A1–B2-level replies.

---

## 6. Data policies (Q6)

| Topic | OpenAI API | DeepSeek API | Gemini API | Anthropic API |
|---|---|---|---|---|
| Training on API data by default | **No** (since 2023-03-01; opt-in only) VERIFIED [S8] | **Unclear / possible.** Privacy policy lists User Input for training with an opt-out; ToS is silent. VERIFIED [S15][S16] | Paid: **No**. Free: **Yes**, and humans may review. VERIFIED [S13][S13c] | **No** (feedback excepted). VERIFIED [S42] |
| Abuse-monitoring retention | Up to **30 days** for `/v1/responses`, `/v1/chat/completions` and `/v1/realtime`. **`/v1/audio/transcriptions`: "None"** in the endpoint table. VERIFIED [S8] | Not stated | Paid: "limited period", not specified | Not checked |
| Application state | Responses API stores for **30 days by default.** Set `store: false`. Prompt-cache KV tensors are kept up to 24 h when ZDR is off. VERIFIED [S8] | — | — | — |
| ZDR / Modified Abuse Monitoring | Requires **prior approval by OpenAI sales**. Transcriptions, Responses and Realtime are ZDR-eligible. VERIFIED [S8] | Not offered | — | — |
| Data residency | India region (`in.api.openai.com`): **storage yes, processing no.** Requires MAM or ZDR approval. +10% for models released on or after 2026-03-05. VERIFIED [S8] | Data stored in PRC | — | — |

**DPDP note (ASSUMPTION; not legal advice, not verified here):** the DPDP Act allows cross-border transfers except to countries the government restricts. Confirm the current notified list and consent wording with counsel.

**Practical setup for OpenAI (ASSUMPTION / best practice):**
- Set `store: false` on every Responses call.
- Send a hashed `safety_identifier`.
- Don't send names or contact details in prompts.
- Keep transcripts in your own DB under your own retention policy.

---

## 7. Real-time speech-to-speech APIs, for comparison (Q7)

| API | Price (VERIFIED [S1][S13][S44]) | Per-minute equivalent | Limitations for our design |
|---|---|---|---|
| OpenAI `gpt-realtime-2.1` | Audio in $32/1M, cached $0.40/1M; audio out $64/1M; text in $4/1M, out $24/1M | User audio is 1 token/100 ms (600 tokens/min), so **$0.0192/min in**. Assistant audio is 1 token/50 ms (1,200 tokens/min), so **$0.0768/min out**. Context is re-billed every turn (mostly cached). | See the common limitations below. |
| OpenAI `gpt-realtime-2.1-mini` | Audio in $10/1M, cached $0.30/1M; audio out $20/1M; text $0.60 / $2.40 | **$0.006/min in, $0.024/min out** | Same as above. It is also OpenAI's named replacement for TTS models shut down on 2027-01-06. |
| OpenAI **GPT-Live 1** (`gpt-live-1`, GA 2026-09-10) | **$0.05/min of session time**, per second, including silence. Backend model billed separately. Session creation pre-bills 15 s, credited later. | $0.25 per 5-minute session + backend | Full-duplex (listens while speaking), which conflicts with tap-to-talk. **Client delegation** lets *your* backend (state machine plus `gpt-6-luna`) decide content, and a sideband WebSocket allows monitoring and steering. Voice output is still model-generated. |
| Google **Gemini 3.8 Live** | Audio in $3/1M or **$0.005/min**; audio out $12/1M or **$0.018/min**; text out $4.50/1M | ~$0.005 in + $0.018 out per min | Free tier data is used for training. Same general limitations as above. |

**Common limitations of speech-to-speech for this product** (ESTIMATE / analysis, unless marked):
- **Weak STT-uncertainty gate.** The model "hears" and answers in one step, so there is no clean point to insert a confidence check or force `unclear`. The input transcription the session returns is a side channel and may differ from what the model actually understood.
- **Harder deterministic control.** Turn-by-turn state-machine control is harder (GPT-Live's client delegation helps). Strict JSON corrections must be done with tool calls or a parallel text call.
- **Observability.** You get audio plus transcripts, not a single auditable "STT text, then LLM JSON" record per turn.
- **Voice consistency.** Built-in voices only. OpenAI's TTS voices are "optimized for English" (VERIFIED [S45]). Japanese and German pronunciation quality must be tested.
- **No visemes.** No viseme or phoneme timing appears in the OpenAI docs I read (absence not proven). Avatar lip-sync would need audio-amplitude or third-party alignment.
- **Cost.** About 6× to 23× the chained STT + LLM pipeline (§8).

---

## 8. Cost model (Q8)

### 8.1 Assumptions (ASSUMPTION)

- **Session:** 5 minutes.
- **Learner audio:** 1.5 min across 10 turns, average 9 s per turn.
- **Tutor calls:** 12 per session. Each has 3,000 input tokens (2,000 static and cacheable, 1,000 dynamic) and 250 output tokens.
- **Caching:** the first call in a session writes the static prefix to the cache and the other 11 read it. With explicit caching mode, the dynamic tokens are billed at the uncached rate with no write fee. If the cache is still warm from another user's session, the cost is slightly lower.
- **Analysis call:** 6,000 uncached input tokens and 1,500 output tokens.
- **Reasoning effort:** `none` for tutor calls, so no hidden reasoning tokens. Sensitivity: +300 reasoning tokens per call at `low` adds 12 × 300 × $0.50/1M = **$0.0018** on `gpt-6-luna`.
- **STT billing:** by audio duration (1.5 min), except Groq, which bills a 10 s minimum per request, so 10 × 10 s = 100 s.
- **Excluded:** TTS, hosting, DB, bandwidth.

### 8.2 Formulas

```
STT_session  = learner_minutes × price_per_min            (Groq: Σ max(10 s, clip) / 3600 × price_per_hour)

Tutor_call_read  = 2000 × P_cached + 1000 × P_in + 250 × P_out      (per token = price per 1M / 1e6)
Tutor_call_write = 2000 × P_write  + 1000 × P_in + 250 × P_out
Tutor_calls      = Tutor_call_write + 11 × Tutor_call_read

Analysis = 6000 × P_in + 1500 × P_out
LLM_session = Tutor_calls + Analysis

Session_total = STT_session + LLM_session
Per_minute    = Session_total / 5
```

### 8.3 Component costs (ESTIMATE from VERIFIED prices)

**STT per session (1.5 min):**

| STT | Cost/session |
|---|---|
| OpenAI `gpt-transcribe` | **$0.00675** |
| OpenAI `gpt-4o-mini-transcribe` (deprecated) | $0.00450 |
| OpenAI `gpt-4o-transcribe` (deprecated) | $0.00900 |
| OpenAI `gpt-live-transcribe` (streaming) | $0.02550 |
| ElevenLabs Scribe v2 | **$0.00550** |
| Deepgram Nova-3 multilingual / monolingual (pre-recorded) | $0.00780 / $0.00645 |
| Groq whisper-large-v3 / v3-turbo (100 s billed) | **$0.00308** / $0.00111 |
| Gemini 3.5 Transcribe | $0.00750 |
| Azure S1 real-time / Fast Transcription | $0.02500 / $0.00900 (5 free hours/month on F0) |
| Google STT V2 standard | $0.02400 |

**LLM per session:**

| LLM | Tutor calls (12) | Analysis | **LLM total** | No-cache total |
|---|---|---|---|---|
| **`gpt-6-luna`** (none) | $0.00317 | $0.00135 | **$0.00452** | $0.00645 |
| Claude Haiku 5.5 | $0.00317 | $0.00135 | $0.00452 | $0.00645 |
| `deepseek-flash`, off-peak | $0.00397 | $0.00180 | $0.00577 | $0.00900 |
| `deepseek-flash`, peak | $0.00793 | $0.00360 | $0.01153 | $0.01800 |
| `gpt-5.6-luna` | $0.00694 | $0.00300 | $0.00994 | $0.01380 |
| `gemini-3.1-flash-lite` | $0.00855 | $0.00375 | $0.01230 | $0.01725 |
| `gemini-3.5-flash-lite` | $0.01236 | $0.00555 | $0.01791 | $0.02385 |
| `gemini-3.8-flash` (promo price to 2026-12-31) | $0.02340 | $0.01012 | $0.03352 | $0.04838 |
| `gpt-6-sol` (quality reference) | $0.06340 | $0.02700 | $0.09040 | $0.12900 |

Worked example for the `gpt-6-luna` tutor calls:
- Write call: 2000 × 0.125/1e6 + 1000 × 0.10/1e6 + 250 × 0.50/1e6 = $0.000475.
- Read call: 2000 × 0.01/1e6 + 0.0001 + 0.000125 = $0.000245.
- Total: 0.000475 + 11 × 0.000245 = **$0.00317**.

Gemini and DeepSeek have no 1.25× write premium. Gemini explicit-cache storage ($1/1M tokens per hour) is ignored here (ESTIMATE).

### 8.4 Combined per session and per minute (ESTIMATE)

| # | Combination | STT | LLM | **Per 5-min session** | **Per minute** |
|---|---|---|---|---|---|
| A | **`gpt-transcribe` + `gpt-6-luna`** (single vendor; no STT confidence) | 0.00675 | 0.00452 | **$0.0113** | **$0.0023** |
| B | **ElevenLabs Scribe v2 + `gpt-6-luna`** (word confidence) | 0.00550 | 0.00452 | **$0.0100** | **$0.0020** |
| C | `gpt-4o-mini-transcribe` + `gpt-6-luna` (logprobs; **only until 2027-02-26**) | 0.00450 | 0.00452 | $0.0090 | $0.0018 |
| D | Groq whisper-large-v3 + `deepseek-flash` off-peak (cheapest; weakest privacy and JSON guarantees) | 0.00308 | 0.00577 | $0.0089 | $0.0018 |
| E | Deepgram Nova-3 multi + `gpt-6-luna` | 0.00780 | 0.00452 | $0.0123 | $0.0025 |
| RT-1 | `gpt-realtime-2.1-mini`, speech-to-speech | — | — | **≈ $0.069–0.077** | ≈ $0.014–0.015 |
| RT-2 | `gpt-realtime-2.1`, speech-to-speech | — | — | ≈ $0.22–0.24 | ≈ $0.044–0.048 |
| RT-3 | GPT-Live 1 + `gpt-6-luna` backend | — | — | ≈ $0.25 + $0.0045 = **$0.255** | ≈ $0.051 |
| RT-4 | Gemini 3.8 Live | — | — | ≈ $0.053 (only speech sent) to $0.07 (continuous mic), plus unverified context re-billing | ≈ $0.011–0.014 |

Speech-to-speech assumptions (ASSUMPTION):
- The tutor speaks 2.5 min per session.
- Low end: 900 user audio tokens and 3,000 assistant audio tokens.
- High end adds average half-conversation context (1,950 audio tokens) re-read on each of 12 turns at the cached audio rate, plus 2,000 cached text-instruction tokens per turn.

### 8.5 Budget view (ESTIMATE)

- **Free credit:** $5 of OpenAI credit covers about **440 sessions** of pipeline A, excluding TTS.
- **Trials:** 1,000 one-time 5-minute trials cost about **$11** for STT + LLM on pipeline A.
- **Monthly:** at 4,000 sessions/month, pipeline A costs about $45, and $50 covers about 4,400 sessions *before TTS and infra*.
- **TTS will likely dominate.** At the realtime-mini output rate of $0.024/min of speech, 2.5 min of tutor speech is about $0.06/session, around 5× STT + LLM. Model TTS carefully in the TTS research.

---

## 9. Comparison table (decision view)

| Criterion | OpenAI `gpt-transcribe` | OpenAI 4o(-mini)-transcribe | ElevenLabs Scribe v2 | Deepgram Nova-3 | Groq Whisper v3 | Azure Speech |
|---|---|---|---|---|---|---|
| Price/min | $0.0045 | $0.003–0.006 | **$0.0037** | $0.0043–0.0052 | ~$0.0019 (10 s minimum) | $0.0167 (real-time); 5 free hr/month |
| Confidence | ✗ (language list only) | Token logprobs | **Word logprob + language probability** | **Word confidence** | Segment logprob / no-speech | NBest + word |
| Silence handling evidence | None published | Good anecdote (JP) | None verified | None verified | Whisper-style hallucination known; mitigate | — |
| Japanese evidence | Aggregate only | FLEURS ja CER 9.89% (mini; competitor paper) | FLEURS ja CER 10.92% (Realtime variant) | `ja` supported, no numbers | FLEURS ja CER 4.97% ("Whisper") | Supported |
| English-only AA-WER | 3.3% | 4.0% / 4.5% | **2.2%** | 5.2% | 4.6% (turbo) | n/a |
| Lifetime risk | New (Jul 2026) | **Shutdown 2027-02-26** | Current | Current | Open model, low lock-in | Current |
| Data | No training; transcriptions not retained for abuse monitoring | Same | ZDR enterprise only; training not verified | MIP opt-out flag | No retention by default | Not checked |

---

## 10. Recommendation

### STT

**Primary: ElevenLabs Scribe v2 (batch, verbatim mode, `language_code` set; keyterms off)**
- **Pros:**
  - Cheapest mainstream option ($0.0037/min).
  - Best English AA-WER (2.2%).
  - **Per-word logprob and `language_probability`**: exactly the signal the "never invent meaning" rule needs to gate corrections.
  - Verbatim by default; `no_verbatim` is opt-in.
  - Audio-event tagging helps detect non-speech.
- **Cons:**
  - Second vendor, with a separate DPA and billing.
  - Zero-retention mode is enterprise-only, and its training policy is not verified here; check before launch.
  - Japanese CER for the Realtime variant was weak in one competitor paper.
  - Latency from India not measured.

**Alternative 1: OpenAI `gpt-transcribe` with `languages[]`.** Simplest: one vendor, one bill, strongest verified data posture (no training; transcriptions endpoint not retained for abuse monitoring). But it has **no confidence output**, so you would rely on the VAD gate, blacklist, language-ID emptiness and LLM self-checks. It is also new, with no independent Japanese evidence.

**Alternative 2: Deepgram Nova-3 (`ja` / `de` / `en-IN`).** Word confidence, `en-IN` explicitly listed, and $200 free credit (about 25,000 sessions of STT). Pass `mip_opt_out=true` on every request. Lowest English accuracy of the group on AA (5.2%).

**Not recommended:**
- Building on `gpt-4o-mini-transcribe` or `gpt-4o-transcribe` because of the logprobs: they shut down 2027-02-26. Use them only for the evaluation.
- Groq Whisper as the *primary* STT, because of Whisper's hallucination history. It is a good cheap second-opinion STT.

**Decide by measurement:** run the §2 test set (error preservation, silence, JA/DE CER, P95 latency from India) on Scribe v2, `gpt-transcribe` and Nova-3. It costs under $1 in API fees.

### LLM

**Primary: OpenAI `gpt-6-luna`.**
- Tutor turns: `reasoning.effort: "none"`, strict `json_schema` via the Responses API with schema-ordered keys, explicit prompt caching, `store: false`.
- End-of-session analysis: effort `low`, or `medium` if quality requires it.
- **Pros:** about $0.0045/session; strict schema adherence; ~0.8–1.0 s TTFT at `none` (REPORTED); no training on API data; uses the existing $5 credit; the Decisions API (beta) can provide calibrated probabilities for classification.
- **Cons:** brand-new (Sept 2026), with no Japanese or German eval; quality at `none` is unproven for nuanced corrections; cache-write premium; OpenAI deprecates models on 6-month cycles.

**Alternative 1: Claude Haiku 5.5.** Same price on this workload ($0.0045/session) and no training on API data. Use it as a quality and failover peer. Latency was not verified, and integration is a second SDK.

**Alternative 2: `gpt-6-sol` for the analysis call only** (about $0.027 per analysis), if luna's session feedback is weak.

**Use DeepSeek `deepseek-flash` only for non-personal, offline jobs** such as content generation for lesson scripts. Reasons:
- JSON mode is not schema-strict and can return empty content.
- Thinking is on by default.
- Data is stored in China and the API ToS is silent on training.
- The remaining $2–3 credit is best spent there.

**Avoid Gemini's free tier for learner data**, since it is used for product improvement and may be human-reviewed. Gemini paid Flash-Lite is a reasonable third option but costs 3–4× luna on this workload.

**Speech-to-speech:** not recommended for v1. It costs 6× to 23× more, offers no clean STT-confidence gate or deterministic JSON per turn, and is full-duplex while the product is tap-to-talk. Revisit GPT-Live with client delegation if you later want hands-free conversation.

### Lock-in risk

- **Low** if you keep a thin internal interface:
  - `transcribe(audio, langs) -> {text, words[{w, conf}], lang, lang_conf}`
  - `tutorTurn(state, transcript) -> JSON`
  - Normalise confidence per provider: logprob to probability, Deepgram confidence as-is, and missing values set to `null`, which forces stricter gating.
- **Highest-risk items:**
  - OpenAI's fast deprecation cadence: four STT models and the TTS models retire within about 4 months, and `gpt-5-mini`/`nano` retire in December.
  - Features unique to one vendor, such as the Decisions API, explicit cache breakpoints, `keywords[]`, and Scribe's `audio_event` tags.
- **Mitigations:**
  - Pin model snapshots.
  - Keep the JSON schema provider-neutral (no vendor-specific `$defs` tricks).
  - Keep the eval set in the repo, so a provider swap is a one-day regression run.

---

## Sources (all accessed 2026-10-14)

- [S1] OpenAI API pricing: https://developers.openai.com/api/docs/pricing (redirect from platform.openai.com/docs/pricing). VERIFIED
- [S2] OpenAI File transcription (speech-to-text) guide: https://developers.openai.com/api/docs/guides/speech-to-text. VERIFIED
- [S3] OpenAI API reference, createTranscription: https://developers.openai.com/api/docs/api-reference/audio/createTranscription. VERIFIED
- [S4] OpenAI Realtime transcription guide: https://developers.openai.com/api/docs/guides/realtime-transcription. VERIFIED
- [S5] OpenAI API changelog: https://developers.openai.com/api/docs/changelog. VERIFIED
- [S6] OpenAI deprecations: https://developers.openai.com/api/docs/deprecations. VERIFIED
- [S7] OpenAI model page, GPT-6 Luna: https://developers.openai.com/api/docs/models/gpt-6-luna; also /models/gpt-6.1-sol, /models/gpt-transcribe, /models/gpt-4o-mini-transcribe, /models/gpt-live-transcribe, /models/gpt-live-1, /models/gpt-realtime-2.1-mini. VERIFIED
- [S8] OpenAI "Your data" / data controls: https://developers.openai.com/api/docs/guides/your-data. VERIFIED
- [S9] OpenAI "Using GPT-6" (latest model) guide: https://developers.openai.com/api/docs/guides/latest-model; reasoning guide: https://developers.openai.com/api/docs/guides/reasoning. VERIFIED
- [S10] OpenAI Structured Outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs. VERIFIED
- [S11] OpenAI Prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching. VERIFIED
- [S12] OpenAI Decisions API guide: https://developers.openai.com/api/docs/guides/decisions. VERIFIED
- [S13] Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing. VERIFIED
- [S13b] Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output. VERIFIED
- [S13c] Gemini API Additional Terms: https://ai.google.dev/gemini-api/terms. VERIFIED
- [S14] DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing; JSON Output: https://api-docs.deepseek.com/guides/json_mode; Thinking mode: https://api-docs.deepseek.com/guides/thinking_mode; Tool calls: https://api-docs.deepseek.com/guides/function_calling. VERIFIED
- [S15] DeepSeek Privacy Policy (last updated 2026-02-10): https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html. VERIFIED
- [S16] DeepSeek Open Platform Terms of Service (effective 2026-04-29): https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html. VERIFIED
- [S17] Deepgram pricing: https://deepgram.com/pricing. VERIFIED
- [S18] Deepgram models and languages: https://developers.deepgram.com/docs/models-languages-overview. VERIFIED
- [S19] Deepgram pre-recorded API reference: https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded; Model Improvement Program: https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program. VERIFIED
- [S20] ElevenLabs API pricing: https://elevenlabs.io/pricing/api. VERIFIED
- [S21] ElevenLabs Speech-to-Text API reference: https://elevenlabs.io/docs/api-reference/speech-to-text/convert. VERIFIED
- [S22] Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text; models/pricing: https://console.groq.com/docs/models. VERIFIED
- [S23] Groq "Your Data": https://console.groq.com/docs/your-data. VERIFIED
- [S24] Google Cloud Speech-to-Text pricing: https://cloud.google.com/speech-to-text/pricing. VERIFIED
- [S25] Azure Retail Prices API (Azure Speech, Central India): https://prices.azure.com/api/retail/prices (filtered by productName 'Azure Speech', armRegionName 'centralindia'). VERIFIED
- [S25b] Azure Speech pricing page (free tier only; prices masked): https://azure.microsoft.com/en-us/pricing/details/speech/. VERIFIED (partial)
- [S26] Microsoft Q&A threads on detailed output / word confidence, e.g. https://learn.microsoft.com/en-us/answers/questions/1408401/azure-cognitive-services-speech-to-text-get-confid. REPORTED
- [S26b] Azure Speech language support (pronunciation assessment, 33 locales): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment. VERIFIED
- [S27] Artificial Analysis, GPT-6 Luna (Non-reasoning): https://artificialanalysis.ai/models/gpt-6-luna-non-reasoning; (Low): https://artificialanalysis.ai/models/gpt-6-luna-low; (Medium): https://artificialanalysis.ai/models/gpt-6-luna-medium. REPORTED
- [S28] Search snapshot of Artificial Analysis GPT-6 Luna variants (TTFT 0.74 / 1.59 / 5.28 s): https://artificialanalysis.ai/models/releases/gpt-6-luna. REPORTED
- [S28b] Artificial Analysis, Gemini 3.5 Flash-Lite comparisons: https://artificialanalysis.ai/models/comparisons/gemini-3-5-flash-lite-vs-claude-4-5-haiku-reasoning. REPORTED (snapshot via search)
- [S29] Artificial Analysis Speech-to-Text leaderboard: https://artificialanalysis.ai/speech-to-text. REPORTED
- [S30] The Decoder, "GPT Transcribe improves on its predecessor but can't catch ElevenLabs, Google or Mistral on error rates" (2026-07-29): https://the-decoder.com/gpt-transcribe-improves-on-its-predecessor-but-cant-catch-elevenlabs-google-or-mistral-on-error-rates/. REPORTED
- [S31] OpenRouter / Artificial Analysis notes on short-clip latency (search results): https://artificialanalysis.ai/speech-to-text/models/gpt-4o-audio; https://community.openai.com/t/latency-with-stttts-pipeline/1305849. REPORTED
- [S32] Mistral AI, "Voxtral Realtime" (arXiv 2602.11298), Table 7 FLEURS: https://arxiv.org/html/2602.11298. REPORTED
- [S33] Koizumi, T. (2025). "Accuracy of Automatic Speech Recognition in L2 Learners' Spontaneous Speech…", *LET Journal of Central Japan* 35:15–30, DOI 10.20656/letcj.35.0_15: https://www.jstage.jst.go.jp/article/letcj/35/0/35_15/_article/-char/en. REPORTED (abstract page; PDF encrypted)
- [S34] Spokenly, "GPT Transcribe" (Common Voice 22-language figure): https://spokenly.app/blog/gpt-transcribe; Impress Watch: https://www.watch.impress.co.jp/docs/news/2128822.html. REPORTED (via search; not opened)
- [S35] McGuire, M. (2025). "Automatic Speech Recognition for Non-Native English: Accuracy and Disfluency Handling", arXiv 2503.06924: https://arxiv.org/abs/2503.06924. REPORTED
- [S36] Koenecke et al. (2024). "Careless Whisper: Speech-to-Text Hallucination Harms", ACM FAccT 2024, arXiv 2402.08021: https://arxiv.org/abs/2402.08021. VERIFIED (abstract)
- [S37] daishir0, "whisper-1のハルシネーション地獄をgpt-4o-transcribeで完全解消した話" (Zenn, 2026-04-08): https://zenn.dev/daishiro/articles/whisper-hallucination-gpt4o-transcribe. REPORTED
- [S38] KaigiAI, "Whisper は沈黙に対して喋る — 会議録音の「幻覚」を3層で止めた話" (Qiita, 2026-09-05, updated 2026-10-11): https://qiita.com/KaigiAI/items/d2921a092cd2a0e2590c. REPORTED
- [S39] remote-whisper issue #81, "無音のときの「ご視聴ありがとうございました」を抑える": https://github.com/Studio-Takumi/remote-whisper/issues/81. REPORTED (via search)
- [S40] OpenAI Developer Community, "GPT-4o-transcribe language enforcement": https://community.openai.com/t/gpt-4o-transcribe-language-enforcement/1357014; Microsoft Q&A on gpt-4o-transcribe language mix-ups: https://learn.microsoft.com/en-us/answers/questions/5583062/issue-with-gpt-4o-transcribe-detecting-wrong-langu. REPORTED (via search)
- [S41] Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing. VERIFIED
- [S42] Anthropic Privacy Center, "Is my data used for model training?": https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training. VERIFIED
- [S43] MMLU-ProX (arXiv 2503.10497): https://arxiv.org/html/2503.10497v1. REPORTED (no scores for the candidate models found)
- [S44] OpenAI Realtime/GPT-Live cost guide: https://developers.openai.com/api/docs/guides/realtime-costs; GPT-Live overview: https://developers.openai.com/api/docs/guides/live; delegation: https://developers.openai.com/api/docs/guides/live-delegation. VERIFIED
- [S45] OpenAI Text-to-speech guide: https://developers.openai.com/api/docs/guides/text-to-speech. VERIFIED

**Not verified / open items:**
- `gpt-transcribe` per-language accuracy and hallucination rate.
- Short-clip STT latency from India for every provider.
- ElevenLabs training-on-data policy.
- Groq `verbose_json` field set.
- Decisions API pricing.
- Haiku 5.5 and DeepSeek TTFT.
- Gemini implicit caching on 3.x models.
- Whether `gpt-transcribe` per-minute billing is per second.
- DPDP cross-border rules.
