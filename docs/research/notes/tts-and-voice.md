# TTS & Voice Research: AI Voice Language Tutor

**Status:** Planning-phase research note. No code.
**Researched / access date for every source:** 2026-10-14.
**Scope:** TTS provider choice, voice consistency, Japanese pronunciation control, lip-sync timing data, slow playback, cost model.

**Evidence labels used throughout**

| Label | Meaning |
|---|---|
| **VERIFIED** | Read on an official/primary source (vendor docs, pricing page, official price API) on 2026-10-14 |
| **REPORTED** | Secondary source (blog, forum, third-party article) or vendor marketing claim not independently checked |
| **ESTIMATE / ASSUMPTION** | My calculation or assumption; formula shown |
| **UNVERIFIED** | Could not confirm; must be tested before relying on it |

Source IDs like `[S1]` point to the **Sources** list at the end.

---

## 0. TL;DR (decision-relevant)

1. **Pricing changed a lot in 2026; do not use older blog numbers.** ElevenLabs released **Eleven v4 / v4 Turbo on 2026-09-28** and now prices **API usage in USD per character**: **$0.04 per 1K chars** for Flash / Turbo / v4 Turbo / v3 Conversational, and **$0.08 per 1K** for v4 / v3 / Multilingual v2. The rate is the same on every plan (VERIFIED [S1][S3][S6]). Mid-2026 secondary sources still quote $0.05 / $0.10 (REPORTED [S40]). The **Starter plan is now $6/month, not $5** (first month $1 under a promo "until Oct 18") (VERIFIED [S2]).
2. **ElevenLabs is the most expensive option at this volume.** A 5-minute English session (about 2,000 TTS chars, ESTIMATE) costs **$0.08 on Flash-class models** and **$0.16 on v4-class models**. **1,000 sessions/month would be about $80–160 on TTS alone**, over the whole $50 budget. Azure Neural costs about $0.03 per session, Google Neural2 about $0.032 (with 1M free chars/month), and Google WaveNet about $0.008 (with 4M free chars/month).
3. **Azure AI Speech (standard neural voices) best fits the hard requirements.** It gives:
   - **viseme events** with 22 IDs and 100-ns offsets. Azure's language-support table lists ja-JP, de-DE, en-IN and en-US, but the TTS overview page says en-US only, so this conflict must be tested.
   - **word-boundary events**
   - **SSML `<phoneme>` with a kana-based phone set for ja-JP**, plus custom lexicons (to fix kanji readings)
   - **`<prosody rate>`** for the Slow button
   - fixed, named native voices
   - **no storage of text or audio** for real-time synthesis

   Downsides: kanji are **billed as 2 characters**. The HD voices drop viseme, prosody and phoneme support, and they add deliberate random variation (VERIFIED [S20][S21][S22][S23][S25]).
4. **ElevenLabs strengths and weaknesses.**
   - Strengths: **character-level timestamps on every TTS endpoint**, likely naturalness, and a big native ja/de voice library.
   - Weaknesses: **output is nondeterministic** (`seed` is "best effort"). **Phoneme tags only work on `eleven_flash_v2` (English-only)**, so Japanese reading fixes are limited to alias dictionaries, rewriting in kana, inline IPA on v4, or `apply_language_text_normalization` (Japanese-only, adds latency). **Eleven v4 has no Speed or Style setting and no SSML**, so a "Slow" re-synthesis is impossible on v4. **Data is retained by default**, and zero-retention is Enterprise-only (VERIFIED [S4][S5][S7][S8][S10][S11]).
5. **Recommendation:** primary = **Azure AI Speech standard neural voices, S0 pay-as-you-go** (F0 free tier for development). Alternative = **ElevenLabs Flash v2.5 (or v4 Turbo) on the $6 Starter plan plus Pay-As-You-Go top-ups**, only if the blind listening test shows a clear win and the volume budget allows. Second alternative = **Google Cloud TTS** (Neural2 for SSML marks, or Chirp 3 HD). **Run the blind test in §11 before paying for anything beyond Starter.**
6. **Open product decision:**
   - **What language does the Japanese/German tutor *explain* in?** If A1 explanations are mostly in English, the "native Japanese voice" must also speak English well. That calls for a multilingual voice (Azure `*MultilingualNeural`, ElevenLabs v4 "native accent handling"), which brings accent-drift risk. It also roughly doubles the TTS characters per Japanese session.
   - **Slow playback:** use **client-side `playbackRate = 0.75` with `preservesPitch`** on cached audio (zero extra TTS cost). Reserve provider-side slow synthesis for short drill phrases.

---

## 1. ElevenLabs

### 1.1 Plans, price, credits, concurrency, commercial use

ElevenLabs now has **two views of the same tiers**: the "ElevenCreative" pricing page, which counts credits for UI usage, and the "ElevenAPI" pricing page, which counts USD for API usage. The API FAQ states "API usage is billed in US dollars, not credits" (VERIFIED [S1]). The two pages give different "included" numbers for the same $ price. They are consistent if the subscription fee buys that many dollars of usage at the API per-character rate, but **confirm in the dashboard after subscribing** (ASSUMPTION).

**API view: included TTS characters per month** (VERIFIED [S1]; Starter row mapped by table order, as the page does not label it)

| Plan | Price/month | Chars at $0.08/1K (v4, v3, Multilingual v2) | Chars at $0.04/1K (Flash/Turbo, v4 Turbo, v3 Conversational) | Commercial use |
|---|---|---|---|---|
| Free | $0 | 10,000 | 20,000 | **No.** Non-commercial only, and published output must be attributed with "elevenlabs.io" or "11.ai" in the title (VERIFIED [S9][S12]) |
| Starter | **$6** ($1 first month, promo "until Oct 18") | 75,000 | 150,000 | Yes, "All paid plans include a commercial license, provided you're not using Beta Services" (VERIFIED [S9]) |
| Creator | $22 ($11 first month) | 275,000 | 550,000 | Yes |
| Pro | $99 | 1,238,000 | 2,475,000 | Yes |
| Scale | $299 | 3,738,000 | 7,475,000 | Yes |
| Business | $990 | 12,375,000 | 24,750,000 | Yes |

**Creative (UI) view** (VERIFIED [S2]): Free 10,000 credits, Starter 30,000, Creator 121,000, Pro 600,000, Scale 1.8M, Business 6M. "V2.5 Flash/Turbo Multilingual (API usage): discounted, between 0.5 and 1 credit per character." Unused credits roll over for up to 2 months on paid plans. Annual billing = pay for 10 months.

**Overage**
- "Usage based billing" is now a **legacy** feature, not available on new self-serve subscriptions. It is replaced by **Pay As You Go (PAYG) prepaid top-ups**:
  - minimum $5 / ₹500
  - subscription credits are consumed first, then PAYG
  - service **pauses at $0 balance** ("no overage charges")
  - without 2FA, PAYG purchases are capped at $100/month on Free/Starter/Creator
  - PAYG credits last 12 months

  (VERIFIED [S13][S14][S15])
- India: subscriptions can be paid **in INR, including via UPI** (VERIFIED [S16]).

**Concurrency** (concurrent *generations*, not conversations) (VERIFIED [S4]):

| Plan | Multilingual v2 | Flash | Text-to-Dialogue WebSocket sessions (v3/v4) |
|---|---|---|---|
| Free | 2 | 4 | 14 |
| Starter | 3 | 6 | 21 |
| Creator | 5 | 10 | 35 |
| Pro | 10 | 20 | 70 |
| Scale/Business | 15 | 30 | 105 |

On the TTS WebSocket, "only active generation time counts toward your plan's concurrency limit; an idle open socket does not count" (VERIFIED [S17]).

**Plan-gated audio formats:** 192 kbps MP3 needs Creator+, and 44.1 kHz PCM needs Pro+ (VERIFIED [S7]). The default `mp3_44100_128` is fine on Starter.

### 1.2 Models (current as of 2026-10-14)

| Model ID | ja / de | Latency (vendor) | Price /1K chars (API) | Notes |
|---|---|---|---|---|
| `eleven_v4` | yes / yes (90+ langs) | not stated | $0.08 | Launched 2026-09-28. No SSML, no Style/Speed sliders. Only Stability and Similarity settings. Inline IPA between slashes. Voices made before v4 "must be retrained to work well" (VERIFIED [S3][S5][S6][S18]) |
| `eleven_v4_turbo` | yes / yes | ~100 ms median inference; ~150 ms time-to-first-speech (vendor) | $0.04 | Real-time variant. Vendor page claims Turbo "speaks Japanese … with a native accent". Streamed via the **Text-to-Dialogue WebSocket** (not the TTS WebSocket) (VERIFIED [S3][S6][S17]) |
| `eleven_v3` | yes / yes (70+) | not stated | $0.08 | **Request stitching not available** (VERIFIED [S8]) |
| `eleven_v3_conversational` | yes / yes | ~280 ms | $0.04 | (VERIFIED [S1][S3]) |
| `eleven_multilingual_v2` | yes / yes (29) | higher than Flash | $0.08 | "Most stable on long-form". `language_code` not supported (VERIFIED [S3][S7]) |
| `eleven_flash_v2_5` | yes / yes (32) | ~75 ms inference | $0.04 | 40K-char limit. Smaller model that "may misread" currencies and phone numbers (VERIFIED [S3][S10]) |
| `eleven_flash_v2` | **English only** | ~75 ms | $0.04 | Only model supporting `<phoneme>` tags (VERIFIED [S10]) |
| `eleven_turbo_v2(_5)` | — | — | — | **Deprecated**: "We recommend using the Flash models over Turbo models in all use cases" (VERIFIED [S3]) |

**Latency caveat:** ElevenLabs' own doc says the ~75 ms figure is model inference only. Time-to-first-audio adds network (20–200 ms), player buffering (~500 ms is common), and the LLM (VERIFIED [S19]). Clusters are in North America, Europe and South-East Asia, and regional hosts exist for US/EU/**India**/Singapore, though residency hosts may be enterprise-only (VERIFIED, availability UNVERIFIED [S7][S41]). A comparison chart on ElevenLabs' marketing page puts **OpenAI gpt-4o-mini-tts at 814 ms** and Cartesia Sonic 3.6 at 262 ms (REPORTED, vendor-produced [S6]).

**Japanese/German quality:**
- Vendor docs say to pick "a voice with an accent that matches your target language" (VERIFIED [S7]).
- Japanese developer reports:
  - Eleven v3 improved kanji readings and intonation (REPORTED [S42]).
  - A concrete misreading: v3 read 「503エラー」 as ゴーゼロサン with a pause. The alias dictionary fix worked only once the dictionary was explicitly connected to a Studio project (REPORTED [S43]).
- I found **no independent benchmark of Japanese pronunciation accuracy** per ElevenLabs model. This must be tested (§7).

### 1.3 Streaming & timestamps (lip-sync data)

- **HTTP `POST /v1/text-to-speech/{voice_id}/with-timestamps`** and **`/stream/with-timestamps`** return `alignment` and `normalized_alignment`. Each has per-character `characters`, `character_start_times_seconds`, `character_end_times_seconds` (VERIFIED [S7][S41]).
- **TTS WebSocket** `wss://…/v1/text-to-speech/{voice_id}/stream-input`:
  - returns `alignment` / `normalizedAlignment` with `chars`, `charStartTimesMs`, `charDurationsMs`, "relative to the returned chunk"
  - by default the first audio waits until **≥120 characters** are buffered unless you `flush`
  - **does not accept `eleven_v3` or `eleven_v4`**

  (VERIFIED [S17][S44])
- **Text-to-Dialogue** endpoints (for v3/v4) also have `stream/with-timestamps` and a WebSocket with `sync_alignment` (VERIFIED [S17][S45]).
- **Implication:** timing is **character**-level, not phoneme/viseme. For lip-sync you need text→phoneme→viseme conversion (ASSUMPTION):
  - English/German: grapheme-to-phoneme
  - Japanese: kanji→kana via a morphological analyser, with each kanji's duration spread across its morae

  Japanese characters map well to visemes once in kana (Azure's kana→viseme table [S24] is a usable reference).
- A separate **Forced Alignment API** exists (VERIFIED it exists [S46]; pricing not checked).

### 1.4 Pronunciation control

| Mechanism | Support | Status |
|---|---|---|
| SSML `<phoneme>` (CMU Arpabet / IPA) | **Only `eleven_flash_v2`** (English-only model) → useless for ja/de | VERIFIED [S10] |
| Pronunciation dictionaries (.PLS / TXT; alias or phoneme rules; up to 3 locators per request, versioned) | API supports `pronunciation_dictionary_locators`. Matching is case-sensitive, first match wins. Alias rules work on non-phoneme models | VERIFIED [S7][S10] |
| Inline IPA in `/slashes/` | Eleven v4 only. "results can still vary by voice and phrase" | VERIFIED [S10][S5] |
| `apply_language_text_normalization` | **Japanese only**. "can significantly increase latency" | VERIFIED [S7][S41] |
| `language_code` (ISO 639-1) | Enforces language and normalization; ignored on Multilingual v2 | VERIFIED [S7] |
| `<break>` | Not on v3/v4 (use `[pause]` tags) | VERIFIED [S10][S6] |

### 1.5 Voice settings, determinism, stitching

- **`voice_settings`:** `stability` (default 0.5), `similarity_boost` (0.75), `style` (0), `use_speaker_boost` (true), `speed` (1.0) (VERIFIED [S7]).
  - **Speed range 0.7–1.2**, and "extreme values may affect quality" (VERIFIED [S47]).
  - **On Eleven v4 only Stability and Similarity exist. No Speed or Style** (VERIFIED [S5]).
- **`seed`** (0 to 4,294,967,295): "best-effort … determinism is not guaranteed" (VERIFIED [S7]).
- **Request stitching:** `previous_text` / `next_text`, or `previous_request_ids` / `next_request_ids` (max 3):
  - request IDs must be ≤ 2 hours old
  - the previous request must have finished completely
  - **not available on `eleven_v3`**
  - unavailable when `enable_logging=false` (zero-retention)
  - "results will be best when the same model is used"
  - On Text-to-Dialogue, `previous_text` / `future_text` are capped at 100 chars and "not supported by every model"

  (VERIFIED [S7][S8][S45])

### 1.6 Native voices & library licensing

- Voice Library voices can be used via API by ID (VERIFIED [S1]). Commercial rights come from the paid plan (VERIFIED [S9][S12]).
- The **Voice Library Addendum** governs owner removal (VERIFIED [S26]):
  - owners can remove a voice at any time
  - users who already added it keep access for the owner-chosen **notice period**
  - past outputs remain usable
  - ElevenLabs "may remove any voice at any time"
- **Observed via the public shared-voices API** (VERIFIED by direct query [S27]). Top-used library voices include:
  - Japanese: "Otani" (male), "Morioki" (female), "Hinata" (male)
  - German: "Susi" (female), "Lea" (female) with **`notice_period: 730`** days; "Carola" has only **30** days

  Each lists `verified_languages` per model (including `eleven_v4`). A `rate` field (1.0 for these) is exposed. I could not find its documented meaning (UNVERIFIED), so check that it is 1.0 before choosing a voice.
- **Recommendation:** pick library voices with **long notice periods (≥ 365 days)**, or make your own Voice Design or Instant Voice Clone (with consent). This removes owner-removal risk.

### 1.7 Data retention

- "By default, ElevenLabs retains data … Customers by default have history preservation enabled." Deleted items persist in backups up to 30 days.
- **Zero Retention Mode** (`enable_logging=false`) is for **Enterprise only**, and it disables request stitching.
- No default retention duration is published.

(VERIFIED [S11])

---

## 2. OpenAI TTS

| Item | Finding | Status |
|---|---|---|
| Models | `gpt-4o-mini-tts`: snapshots `gpt-4o-mini-tts-2025-12-15` (default) and `-2025-03-20`. Also `tts-1`, `tts-1-hd` | VERIFIED [S28][S29] |
| Price | gpt-4o-mini-tts: $0.60 / 1M text input tokens, **$12 / 1M audio output tokens**. tts-1 **$15 / 1M chars**. tts-1-hd **$30 / 1M chars** | VERIFIED [S30] |
| Per-minute | ~**$0.015/min** for gpt-4o-mini-tts (not on the current pricing page; widely repeated and forum-confirmed as an estimate) | REPORTED [S31] |
| Voices | alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, **marin, cedar** ("For best quality, we recommend using `marin` or `cedar`"). tts-1/-hd have 9 of these. Custom voices (`{id}`) "must be created from audio samples" (access conditions not checked) | VERIFIED [S28][S29] |
| Languages | Follows Whisper's ~57 languages. "Voices are optimized for English" | VERIFIED [S28] |
| `instructions` | Free-text steering of accent, tone, speed and more. Not on tts-1/-hd | VERIFIED [S29] |
| `speed` | 0.25–4.0 in the API reference. **OpenAI staff said in May 2025 that `speed` was not supported on gpt-4o-mini-tts**, and a later user said it works. Status unclear, so test it | VERIFIED (param) / REPORTED (support) [S29][S32] |
| Streaming | Chunked transfer. `stream_format` `sse` or `audio` (`sse` not on tts-1). Formats mp3/opus/aac/flac/wav/pcm (24 kHz 16-bit). WAV/PCM recommended for lowest latency | VERIFIED [S28][S29] |
| Timestamps | **None documented**, so lip-sync would need amplitude or forced alignment | VERIFIED (absence on the guide page) [S28] |
| Disclosure | Must "provide a clear disclosure to end users that the TTS voice they are hearing is AI-generated" | VERIFIED [S28] |
| Consistency risk | Developers report **the same voice and same instructions sounding like different speakers across requests**. Threads requesting a seed run from Apr 2025 to Mar 2026. **No seed parameter exists** | REPORTED [S33] |
| Japanese | Reports of unnatural intonation mid-way through long Japanese paragraphs. Workaround: shorter sentences and line breaks | REPORTED [S34] |

**Verdict:** cheap, but timing data is missing and the `instructions` steering makes cross-request voice consistency risky. That conflicts with the "fixed character voice" requirement. If used, prefer **tts-1-hd (no instructions)** for consistency, or pin the gpt-4o-mini-tts snapshot and keep one fixed, short instruction string.

---

## 3. Azure AI Speech TTS

### 3.1 Pricing & free tier

Official Azure **Retail Prices API** for `eastus`, 2026-10-14 (VERIFIED [S20]). The marketing pricing page showed "$-" placeholders in the fetch, so the API was used instead.

| Meter | Price |
|---|---|
| Neural (standard) TTS, S1/S0 pay-as-you-go | **$15 / 1M chars** |
| **Neural HD** TTS (effective 2026-03-01) | **$22 / 1M chars** |
| Custom Neural (realtime) | $24 / 1M |
| CNV Neural HD | $48 / 1M |
| Commitment tier 80M chars | $960 / month (not relevant) |

- **Free tier (F0):** "Neural: 0.5 million characters free per month" (VERIFIED [S21]). F0 is limited to **20 transactions per 60 seconds**, and this is not adjustable. S0 default is **30 TPS**, adjustable up to 1,000. Max 10 minutes of audio per request (VERIFIED [S22]).
  - F0 is fine for development.
  - **F0 is too tight for production**: each streamed sentence or turn is a transaction, so about 20 per minute across all users.
  - F0 does not carry a free allowance into S0. They are separate pricing tiers on a resource (ASSUMPTION based on tier structure, so confirm).

**Billing gotchas** (VERIFIED [S25]):
- **"Each Chinese character is counted as two characters for billing, including kanji used in Japanese."**
- Billable characters include **SSML markup** (except `<speak>` and `<voice>`), spaces and punctuation.

### 3.2 Voices (ja-JP / de-DE / en-IN / en-US)

From the language-support table (VERIFIED [S23]).

| Locale | Standard neural (full SSML) | Multilingual | Neural HD (DragonHD) | Preview |
|---|---|---|---|---|
| ja-JP | NanamiNeural (F), KeitaNeural (M), AoiNeural (F), DaichiNeural (M), MayuNeural (F), NaokiNeural (M), ShioriNeural (F) | MasaruMultilingualNeural (M) | Nanami, Masaru `:DragonHDLatestNeural` | Haruto/Sakura `:MAI-Voice-2-Flash` |
| de-DE | KatjaNeural (F), ConradNeural (M), AmalaNeural, BerndNeural, ChristophNeural, ElkeNeural, KasperNeural, KillianNeural, KlarissaNeural, KlausNeural, LouisaNeural, MajaNeural, RalfNeural, TanjaNeural, GiselaNeural (child) | SeraphinaMultilingualNeural (F), FlorianMultilingualNeural (M) | Seraphina, Florian | Klaus/Mia `:MAI-Voice-2(-Flash)` |
| en-IN | NeerjaNeural, AartiNeural, ArjunNeural, PrabhatNeural, KavyaNeural, AashiNeural, AnanyaNeural, KunalNeural, RehaanNeural, AaravNeural, plus `*IndicNeural` variants | — | Diya, Meera, Aarti, Arjun, Neerja, Lavanya | — |

Multilingual voices "can speak in the auto-detected language of the input text", and `<lang xml:lang>` sets the preferred accent (VERIFIED [S23]).

### 3.3 Viseme & word-boundary events (lip-sync)

- **22 viseme IDs (0–21)**, each with an `AudioOffset` in **ticks of 100 ns**. You get them by subscribing to `VisemeReceived` in the Speech SDK (JavaScript included) (VERIFIED [S24]). Mapping the 22 IDs to your 8–10 SVG mouth shapes is a static lookup table (ASSUMPTION).
- **SVG animation output is en-US only. Blend shapes (55 values at 60 fps) are available for de-DE, en-IN and en-US. ja-JP has "Viseme ID" only** (VERIFIED [S23][S24]). Viseme IDs alone are enough for a custom 2D SVG avatar.
- **Conflict:** the TTS overview page says "Viseme is currently supported only for the `en-US` (US English) neural voices" [S25]. The newer language-support table [S23] and phonetic-sets page [S35] list ja-JP and de-DE viseme support, and the latter has a kana→viseme-ID table. **Test ja-JP and de-DE viseme events on day 1.**
- **HD voices do NOT support `<mstts:viseme>`, `<prosody>` or `<bookmark>`.** DragonHD supports `<phoneme>` and alias-only lexicons. Dragon HD Omni supports word boundaries but not phoneme (VERIFIED [S36]). **Use standard (non-HD) neural voices if you want visemes and the Slow-rate control.**
- Word boundary events give `Text`, `AudioOffset` and `TextOffset` (VERIFIED [S36]).

### 3.4 Pronunciation, prosody, Japanese readings

- **`<phoneme alphabet="sapi|ipa|ups|x-sampa">`**, where ja-JP uses a **kana-based "sapi" phone set** (e.g., 合成 → `ゴ'ウセ`) or IPA. Unknown phones return HTTP 400 (VERIFIED [S35][S37]).
- **Custom lexicon** (PLS, `ipa` or `x-microsoft-sapi`):
  - must be at a publicly reachable URL (SAS allowed)
  - ≤ 100 KB
  - cached for 15 minutes
  - one locale per lexicon
  - case-sensitive
  - alias has priority over phoneme
  - kanji compounds can be mapped to readings

  (VERIFIED [S37])
- `<sub alias>` and `<say-as interpret-as="date|cardinal|ordinal|currency|unit…">` are supported for Japanese and German (VERIFIED [S37]).
- **`<prosody rate="-25%">` works on standard voices only (not HD)** (VERIFIED [S36]).
- HD voices have `temperature` (default 1.0), and HD Omni has `temperature`/`top_p`/`top_k`/`cfg_scale`. "Neural TTS HD voices introduce slight variations in each output" (VERIFIED [S36]).
- `DragonHDLatestNeural` **always tracks the latest base model**, which is a consistency risk (VERIFIED [S36]).

### 3.5 Latency, integration, data

- **Latency:** "Less than 300 ms" for both HD and non-HD Azure Speech voices (vendor comparison table; VERIFIED as vendor claim [S36]).
- **Web-app pattern:**
  - **Browser:** the Speech SDK for JavaScript runs in the browser with a **short-lived authorization token** from `https://<resource>.cognitiveservices.azure.com/sts/v1.0/issueToken`. The token is valid **10 minutes**, and Microsoft suggests reusing it for 9. Your backend brokers the key (VERIFIED [S38]).
  - **Server-side:** call the SDK or REST API from your backend and stream audio plus viseme JSON to the client. Simpler for keeping the LLM→TTS pipeline on the server.
- **Data:** "Microsoft doesn't retain or store the text that you provide with the real-time synthesis text to speech API" and "doesn't store audio … generated with the real-time synthesis API" (VERIFIED [S39]). This is the best privacy story of the providers surveyed.

---

## 4. Google Cloud Text-to-Speech

**Pricing** (VERIFIED [S48]; fetched raw page 2026-10-14)

| Voice family | Free / month | Price |
|---|---|---|
| **Chirp 3: HD** | 0–1M chars | **$30 / 1M chars** |
| Instant custom voice | none | $60 / 1M |
| **WaveNet** (now same SKU as Standard) | **0–4M chars** | **$4 / 1M** |
| Standard | 0–4M chars | $4 / 1M |
| **Neural2** | 0–1M chars | **$16 / 1M** |
| Polyglot (Preview) | 0–1M | $16 / 1M |
| Studio | 0–1M | $160 / 1M |
| Gemini 3.8 Flash TTS (Preview) | none | $0.50 / 1M input tokens. $9 / 1M audio tokens **through 2026-12-31**, then $1 / $18. "25 tokens per second of audio" |
| Gemini 3.8 Flash-Lite TTS (Preview) | none | $0.50 / $6 (to 2026-12-31), then $1 / $12 |
| Gemini 2.5 Pro TTS / 3.1 Flash TTS (Preview) | none | $1 / $20 |

All SSML tags except `<mark>` count toward billed characters. A Japanese multibyte character counts as one character (VERIFIED [S48]).

**Chirp 3: HD** (VERIFIED [S49]):
- supports ja-JP, de-DE and en-IN
- voices are named e.g. `ja-JP-Chirp3-HD-Kore` (30 voice names)
- streaming is supported, but **SSML is not supported on streaming**
- SSML on synchronous requests is Preview: `<phoneme>`, `<sub>`, `<say-as>`, `<prosody>`, `<break>`, etc.
- `speaking_rate` 0.25–2.0 is supported in ja/de/en-IN
- custom pronunciations via IPA/X-SAMPA in ja/de/en-IN
- **No timepoints/marks mentioned**, so treat Chirp 3 HD as having **no timing data** (UNVERIFIED absence)

**Timepoints:** SSML `<mark>` plus `enableTimePointing: SSML_MARK` returns the time of marks you insert. That gives word-level timing at best, not phonemes. **Japanese `<phoneme>` must use the `yomigana` alphabet** (VERIFIED [S50]). Which voice families support marks is not stated on that page. Neural2/WaveNet are commonly used for marks (REPORTED), so test.

---

## 5. Other providers (brief, only where official sources were read)

| Provider | Price | ja / de | Timestamps | Notes |
|---|---|---|---|---|
| **Cartesia Sonic 3.6** | Free $0 (20K credits). **Pro $5/mo (100K)**. Startup $49 (1.25M). Scale $299 (8M). **1 credit = 1 character**. Concurrency 2/3/5/15. Commercial use from Pro (VERIFIED [S51]) | Yes / yes, plus Hindi and Hinglish (44 langs) (VERIFIED [S52]) | **Word and phoneme timestamps** via SSE (`add_phoneme_timestamps`). Example is English; per-language support UNVERIFIED [S53] | **Dated snapshots** (`sonic-3.6-2026-08-27`): "A dated snapshot never changes once released", which is excellent for consistency. Speed 0.6–1.5, treated as "guidance". IPA phoneset is English-oriented. Pronunciation dictionaries support IPA or "sounds-like" (VERIFIED [S52][S54]) |
| **Deepgram Aura-2** | **$0.030 / 1K chars** PAYG ($0.027 Growth). **$200 free credit** for new PAYG accounts, non-expiring (VERIFIED [S55]) | ja: 5 voices (uzume, ebisu, fujin, izanami, ama). de: 7 voices (VERIFIED [S56]) | Not checked | Japanese quality unknown. The $200 credit (~6.7M chars, about 3,300 EN sessions, ESTIMATE) is worth a test |
| **Gemini TTS** (Google, see §4) | ~$0.0135/min until end-2026 (ESTIMATE from 25 tok/s × $9/1M) | Not checked | Not checked | Preview, and prompt-steered, so it carries the same consistency risk as gpt-4o-mini-tts |
| **Azure MAI-Voice-2 / -Flash** | Not found in the retail price API | ja/de preview voices exist [S23] | Not checked | Preview |

---

## 6. Voice-consistency strategy

### 6.1 Causes of voice/accent drift (with evidence)

| Cause | Evidence | Status |
|---|---|---|
| **Voice not native to the language.** "might retain its native accent, or drift between different accents" | ElevenLabs help [S57] | VERIFIED |
| **English-only model on non-English text** produces an English accent | ElevenLabs help [S57] | VERIFIED |
| **"The language is determined by the text, the accent … by the voice."** Closely related languages can confuse it | ElevenLabs help [S58] | VERIFIED |
| **Eleven v4 deliberately drops the reference accent when generating another language** ("native accent handling"). A Japanese voice speaking English will sound like fluent English, not Japanese-accented English. "Still being fine-tuned" | ElevenLabs v4 doc [S5] | VERIFIED |
| **Random sampling.** ElevenLabs output is nondeterministic and `seed` is best-effort. Azure HD voices add variation by design (temperature) | [S7][S36] | VERIFIED |
| **Instruction-steered TTS.** gpt-4o-mini-tts sounds like different speakers across requests | OpenAI forum [S33] | REPORTED |
| **Model version changes.** `DragonHDLatestNeural` floats. ElevenLabs deprecated Turbo v2/v2.5. v4 "may sound substantially different from Eleven v3". OpenAI behaviour changed between snapshots | [S36][S3][S5][S33] | VERIFIED / REPORTED |
| **Long inputs.** Japanese intonation degrades in long paragraphs (OpenAI) | [S34] | REPORTED |
| **Too many break tags** cause "the AI might speed up" or become unstable (ElevenLabs) | [S10] | VERIFIED |
| **Very short inputs** (1–3 words) are less stable | No primary source found | UNVERIFIED (test it) |
| **Bad text normalisation** (numbers, dates, currencies, alphanumerics), especially on small models such as Flash | [S10][S43] | VERIFIED / REPORTED |

### 6.2 Mitigations (ordered by value)

1. **One fixed voice ID per character, one fixed settings object, one pinned model ID**, stored in config and logged with every generation.
   - ElevenLabs: explicit `model_id` and fixed `stability` / `similarity_boost` / `style` / `speed`. Consider a moderately high Stability.
   - Azure: standard voice names (not `…LatestNeural`).
   - OpenAI: dated snapshot.
   - Cartesia: dated snapshot.
2. **Native-language voice for the dominant language of each utterance.** Set `language_code` (ElevenLabs, non-Multilingual-v2 models) or `xml:lang` / `<lang>` (Azure).
3. **Fixed `seed`** on ElevenLabs (helps, not guaranteed). Azure standard neural voices: whether output is bit-identical across calls is UNVERIFIED, so measure it (§7).
4. **Sentence-level chunking of moderate length** (about 40–200 chars) to balance streaming latency against prosody. Use **request stitching** (`previous_text`) on ElevenLabs models that support it, but not v3.
5. **Mixed-language segments:** pick a policy per character.
   - **(a)** Keep the quoted foreign word in the tutor's voice and accept an L1-accented pronunciation. This is realistic, since a Japanese teacher saying "apple" sounds Japanese.
   - **(b)** Wrap it in `<lang>` with an Azure multilingual voice.
   - **(c)** Generate it as a separate segment with the same voice and an explicit `language_code`.

   **Never switch to a different voice ID** for a quote. For Hindi words from learners, transliterate to the tutor language's script or alias them.
6. **Pronunciation dictionaries / lexicons** for recurring problem words: course vocabulary, names, counters.
7. **Deterministic text normalisation before TTS:**
   - Have the LLM output spelled-out numbers and dates, or post-process with code. This is officially recommended by ElevenLabs [S10].
   - German: decimal commas, dates `14.10.2026` → "vierzehnter Oktober …", units.
   - Japanese: counters with sound changes (一本 いっぽん / 三本 さんぼん), dates (一日 ついたち), times.
   - Or use Azure `<say-as>`.
8. **Cache every generated clip** (keyed by voice + model + settings + text). Replay and repeated stock phrases then cost nothing and never drift.

### 6.3 Japanese specifics

- **Kanji misreadings.** Ambiguous items include 今日 (きょう/こんにち), 一日 (ついたち/いちにち), 方 (かた/ほう), 行った (いった/おこなった), 上手 (じょうず/うわて), plus names and counters.
- **Recommended pipeline** (ASSUMPTION / design):
  1. Ask the LLM to emit ruby annotations for non-trivial kanji, e.g. `漢字{かんじ}`. You need furigana for learners anyway.
  2. Convert them per provider:
     - **Azure:** `<phoneme alphabet="sapi" ph="…">` with katakana, or `<sub alias="かんじ">漢字</sub>`, or a custom lexicon
     - **Google:** `<phoneme alphabet="yomigana" ph="…">`
     - **ElevenLabs:** alias dictionary entries, inline kana substitution, or v4 inline IPA
  3. Display the original kanji on screen.
- **Whole-sentence kana input** fixes readings but can remove word-boundary cues and change pitch-accent and phrasing. Substitute only the ambiguous word (ASSUMPTION; test it).
- **Pitch accent:** none of the providers documents explicit pitch-accent control except Azure's kana phone set, whose `'` mark appears to mark accent (symbols not defined on the page, UNVERIFIED [S35]). Judge it by native listeners in the blind test.
- **Japanese-specific normalisation flag** on ElevenLabs: `apply_language_text_normalization=true` (adds latency) [S7].

### 6.4 Can one voice credibly speak all three languages natively?

- **Vendor claims, yes.** ElevenLabs v4 says "every voice usable across every supported language" with native-sounding target-language output [S5]. Azure multilingual and HD Omni voices claim multilingual output with `<lang>` accent selection [S23][S36].
- **Independent evidence: none found.**
- **Product view:** a fixed *native* character voice is still the safer choice for nativeness of the target language. A multilingual voice is needed only if the tutor explains at length in English.
- Treat "one voice for all three" as a **test hypothesis**, not a fact.

---

## 7. Evaluating actual spoken output objectively (solo-developer protocol)

### 7.1 Test corpus (per language, about 40 lines)

- 15 typical tutor turns at A1–B2 level (greeting, correction, explanation, question)
- 5 mixed-language lines (Japanese/German tutor quoting an English word, a Hindi word from the learner)
- 5 numbers/dates/times/currencies/units
- Japanese: 10 kanji-ambiguity sentences. German: 5 compound/umlaut/loanword sentences
- 3 very short (1–3 words), 2 long (> 250 chars)

### 7.2 Automatic metrics

| Metric | How | Tool | Use |
|---|---|---|---|
| **ASR round-trip CER/WER** | Transcribe TTS output and compare with the input text. For Japanese compute **CER on kana-normalised text**: convert both reference and hypothesis to kana with a morphological analyser, so kanji/kana spelling differences don't count as errors | Whisper (`turbo` = optimised large-v3, MIT licence, Japanese supported [S59]) | Flags misreadings, dropped words, wrong language. Inspect anything above the median by hand; the threshold is ESTIMATE, so calibrate on your data |
| **Speaker-embedding similarity** | Cosine similarity of each clip's embedding to the character's **reference centroid** (mean of 10 approved clips) | SpeechBrain ECAPA-TDNN `spkrec-ecapa-voxceleb` (EER 0.80% on VoxCeleb1, Apache-2.0, 16 kHz mono [S60]) or Resemblyzer (256-dim, Apache-2.0 [S61]) | **Detects voice drift.** Flag clips below `mean − 3σ` of the reference distribution. Also run across days and model versions as a regression test |
| **Speaking rate** | Japanese: morae/s (count morae from the kana reading ÷ voiced duration, after silence trimming with VAD). de/en: syllables/s | Kana from analyser; syllables from a hyphenator or G2P | Detects rate drift, and checks that "Slow" ≈ 0.75× |
| **Pitch statistics** | Median F0, F0 IQR / semitone range per clip | Praat via parselmouth, or librosa pyin | Large shifts from the reference median suggest a different persona or emotion drift |
| **Determinism check** | Generate the same text 5× with the same settings and seed. Compute pairwise embedding similarity and duration variance | Same as above | Quantifies sampling variability per provider |
| **Latency** | Measure time-to-first-audio from your actual server region (ideally India) for each candidate | Your own timer | Must fit the 1.5–3 s budget along with STT and LLM |

### 7.3 Listening tests

- Use a lightweight **MOS** (5-point ACR, after ITU-T P.800 [S62]) on naturalness and pronunciation correctness.
- Use **MUSHRA-lite** (ITU-R BS.1534-3 [S63]) for side-by-side comparison.
- Add a **pairwise "same speaker?"** test for consistency.

Details in §11.

---

## 8. Slow playback (~0.75×)

| Approach | Quality | Cost | Lip-sync | Notes |
|---|---|---|---|---|
| **Client-side `HTMLMediaElement.playbackRate = 0.75` with `preservesPitch = true`** (default true; Baseline "widely available" since Dec 2023) | Time-stretching keeps pitch, but artefacts are possible (slightly smeared or robotic). Pauses are not lengthened in a natural way | **$0 extra**. Works on the cached clip, offline, instantly | Scale the viseme/character timeline by 1/0.75 | VERIFIED [S64]. Note: Web Audio `AudioBufferSourceNode.playbackRate` changes pitch (no pitch preservation), so you need a media element or a time-stretch library (ASSUMPTION) |
| **Re-synthesise at lower provider rate** | Usually more natural, with clearer articulation and lengthened pauses. Results vary because speed is "guidance" | **+100% of that message's TTS cost** per Slow press, plus a new request's latency | New timestamps come back with the audio | ElevenLabs `speed` 0.7–1.2 (not on v4) [S47][S5]. Azure `<prosody rate>` (standard voices only) [S36]. Google `speaking_rate` 0.25–2.0 [S49]. OpenAI `speed` 0.25–4 (support on gpt-4o-mini-tts disputed) [S29][S32]. Cartesia 0.6–1.5 [S54] |

**Recommendation** (ESTIMATE / ASSUMPTION):
- Use client-side time-stretch as the default Slow behaviour.
- Pre-generate provider-slow audio only for short vocabulary or drill phrases, where clarity matters most and text is reused, then cache it.
- Measure: if more than ~20% of messages get Slow-pressed, re-synthesis would add more than 20% to TTS cost. Prefer client-side.
- Run one listening item comparing the two (§11).

---

## 9. Cost model

### 9.1 Characters per minute of tutor speech (ESTIMATE)

| Language | Assumption | chars/min (cpm) | Basis |
|---|---|---|---|
| English | ~140 words/min learner-directed × ~5.7 chars/word (incl. space and punctuation) | **≈ 800** (range 700–950) | ESTIMATE. ElevenLabs' own conversion "10,000 [credits] ~10 min" implies ~1,000 chars/min (VERIFIED [S1][S2]) |
| German | ~125 words/min × ~6.9 chars/word (longer words) | **≈ 850** (range 750–1,000) | ESTIMATE |
| Japanese (pure) | Japanese broadcast norms of **300–400 chars/min** of kana-kanji text (REPORTED [S65]). Tutor speaking slowly to learners → ~300 | **≈ 300** (range 250–400) | REPORTED + ESTIMATE |
| Japanese tutor with 50% English explanation | 0.5 × 800 + 0.5 × 300 | **≈ 550** | ESTIMATE |
| **Conservative planning ceiling** | ElevenLabs' implied conversion | **1,000** | VERIFIED conversion, ESTIMATE as an upper bound |

Japanese packs more speech per character. Cross-language research (Pellegrino et al. 2011, *Language* 87(3)) finds Japanese among the fastest in syllables/s (~8/s) but carrying less information per syllable (REPORTED [S66]).

### 9.2 Per-session TTS cost

**Formula:** `C_session = cpm × T_tutor`, with T_tutor = 2.5 min. Then `Cost_session = C_session × billable_multiplier × price_per_char`.

- EN: 800 × 2.5 = **2,000 chars**
- DE: 850 × 2.5 = **2,125**
- JA pure: 300 × 2.5 = **750**
- JA mixed: 550 × 2.5 = **1,375**
- Conservative: 1,000 × 2.5 = **2,500**

**Azure Japanese:** kanji count double. Assuming ~30% of Japanese characters are kanji, `billable = 750 × 1.3 ≈ 975` (ESTIMATE). Add ~5–10% SSML markup overhead for Azure/Google if you use phoneme/prosody tags (ESTIMATE; not included below).

**Time-based models:**
- gpt-4o-mini-tts: `$0.015/min × 2.5 = $0.0375`
- Gemini 3.8 Flash TTS: `2.5 min × 60 s × 25 tok/s × $9/1M = $0.034` (+ negligible input). From 2027-01-01: `× $18/1M = $0.068`.

| Provider / model | $ per 1M chars | EN (2,000) | DE (2,125) | JA pure (750) | Conservative (2,500) |
|---|---|---|---|---|---|
| ElevenLabs Flash v2.5 / v4 Turbo / v3 Conv. | 40 | **$0.080** | $0.085 | $0.030 | $0.100 |
| ElevenLabs v4 / v3 / Multilingual v2 | 80 | **$0.160** | $0.170 | $0.060 | $0.200 |
| Azure Neural (standard) | 15 | **$0.030** | $0.032 | $0.015 (975 billable) | $0.0375 |
| Azure Neural HD | 22 | $0.044 | $0.047 | $0.021 | $0.055 |
| Google Chirp 3 HD | 30 (after 1M free) | $0.060 | $0.064 | $0.023 | $0.075 |
| Google Neural2 | 16 (after 1M free) | $0.032 | $0.034 | $0.012 | $0.040 |
| Google WaveNet / Standard | 4 (after 4M free) | $0.008 | $0.0085 | $0.003 | $0.010 |
| OpenAI tts-1 | 15 | $0.030 | $0.032 | $0.011 | $0.0375 |
| OpenAI tts-1-hd | 30 | $0.060 | $0.064 | $0.023 | $0.075 |
| OpenAI gpt-4o-mini-tts | ~$0.015/min (REPORTED) | $0.0375 | $0.0375 | $0.0375 | $0.0375 |
| Gemini 3.8 Flash TTS (Preview, 2026 price) | token-based | $0.034 | $0.034 | $0.034 | $0.034 |
| Deepgram Aura-2 | 30 | $0.060 | $0.064 | $0.023 | $0.075 |
| Cartesia (Startup plan, effective $49 / 1.25M) | 39.2 | $0.078 | $0.083 | $0.029 | $0.098 |

### 9.3 Monthly TTS cost by volume

Assumes ~2,000 chars per session on average and **no caching savings**. Formula: `chars_month = N × 2,000`.

| Sessions/month (N) | 500 (1M chars) | 1,000 (2M) | 3,000 (6M) |
|---|---|---|---|
| ElevenLabs Flash-class ($6 Starter covers first $6) | $40 | $80 | $240 |
| ElevenLabs v4-class | $80 | $160 | $480 |
| Azure Neural S0 | $15 | $30 | $90 |
| Google Neural2 (1M free) | $0 | $16 | $80 |
| Google Chirp 3 HD (1M free) | $0 | $30 | $150 |
| Google WaveNet (4M free) | $0 | $0 | $8 |
| OpenAI gpt-4o-mini-tts | $18.75 | $37.50 | $112.50 |
| Gemini 3.8 Flash TTS (2026 price) | $16.90 | $33.75 | $101 |

**Reading this against the $50 total budget:**
- With 500–1,000 one-time trial sessions per month, only Azure Neural, Google Neural2/WaveNet/Chirp (within free tiers), OpenAI tts-1 and Gemini TTS leave room for the LLM and STT.
- ElevenLabs Flash is affordable only up to roughly **250–400 sessions/month**: `(budget_for_TTS − $6) / $0.08 + 75`. Example: with $25 allocated to TTS, ≈ 75 + 19/0.08 ≈ 312 sessions.

### 9.4 ElevenLabs: sessions covered by each plan's included usage

Formula: `sessions = included_chars(model class) / C_session` (API-view inclusions [S1]).

| Plan | Included chars, Flash-class / v4-class | EN (2,000): Flash / v4 | DE (2,125): Flash / v4 | JA pure (750): Flash / v4 | Conservative (2,500): Flash / v4 |
|---|---|---|---|---|---|
| Free (non-commercial) | 20K / 10K | 10 / 5 | 9 / 4 | 26 / 13 | 8 / 4 |
| **Starter $6** | 150K / 75K | **75 / 37** | 70 / 35 | 200 / 100 | 60 / 30 |
| **Creator $22** | 550K / 275K | **275 / 137** | 258 / 129 | 733 / 366 | 220 / 110 |
| Pro $99 | 2.475M / 1.238M | 1,237 / 619 | 1,164 / 582 | 3,300 / 1,650 | 990 / 495 |

**If** API calls are instead drawn from the Creative credit pool (Starter 30K credits, Flash at 0.5–1 credit/char), Starter would cover only **15–30 EN sessions**. **Verify which applies in the dashboard on day 1** (sources conflict in presentation [S1] vs [S2]).

---

## 10. Provider comparison table

| | **Azure Neural (standard)** | **ElevenLabs Flash v2.5 / v4 Turbo** | ElevenLabs v4 | Google Chirp 3 HD | Google Neural2 | OpenAI gpt-4o-mini-tts | Cartesia Sonic 3.6 |
|---|---|---|---|---|---|---|---|
| $/1M chars | 15 (kanji ×2) | 40 | 80 | 30 (1M free) | 16 (1M free) | ~$0.015/min | ~39–50 |
| Free tier | 0.5M/mo (F0, 20 tx/min) | 20K Flash chars, **non-commercial** | 10K, non-commercial | 1M/mo | 1M/mo | none | 20K credits |
| Native ja/de/en voices | Yes, many | Yes (library) | Yes (library) | Yes | Yes | English-optimised voices | Yes |
| Timing data | **Viseme IDs + word boundaries** (ja-JP viseme: conflicting docs) | **Char-level alignment** | Char-level (via Dialogue endpoints) | None documented | SSML `<mark>` timepoints | None | Word + phoneme timestamps (lang coverage UNVERIFIED) |
| Japanese reading control | **SSML phoneme (kana sapi / IPA), lexicon, sub, say-as** | Alias dictionary, `apply_language_text_normalization` | Alias, inline IPA | phoneme (IPA/X-SAMPA), sync only | phoneme (`yomigana`) | none | Dictionary (IPA English-oriented, "sounds-like") |
| Slow via provider | `<prosody rate>` | `speed` 0.7–1.2 | **No speed** | `speaking_rate` | `speakingRate` | `speed` (disputed) | 0.6–1.5 guidance |
| Determinism / pinning | Named voices. Standard neural likely stable (UNVERIFIED). Avoid `…Latest` HD | `seed` best-effort. Model IDs can be deprecated | Same | Voice names. Model versioning not checked | Same | Snapshots. No seed. Drift reported | **Dated snapshots** |
| Latency (vendor) | < 300 ms | ~75 ms / ~100 ms inference | not stated | not checked | not checked | ~814 ms (competitor chart) | 262 ms (competitor chart) |
| Data retention | **Not stored** (real-time) | Retained by default. ZRM Enterprise-only | Same | not checked | not checked | not checked | not checked |
| Commercial use | Yes (Azure terms) | Paid plans only | Paid plans only | Yes | Yes | Yes + AI disclosure required | Pro+ |

---

## 11. Recommendation

### 11.1 Primary: Azure AI Speech, standard neural voices

**Why:**
- It meets the most hard requirements at the lowest cost:
  - fixed native voices
  - viseme IDs plus word boundaries for the SVG avatar
  - kana-level phoneme and lexicon control for kanji readings
  - SSML rate for slow re-synthesis when needed
  - no data storage
  - $15/1M chars (≈ $0.03 per EN session; ≈ $30 for 1,000 sessions)
  - an F0 free tier for development
- Microsoft's Central India region could lower latency for Indian users. Voice availability per region is not checked, so verify it.

**Setup** (ASSUMPTION):
- Create one S0 Speech resource in a region near India that offers the chosen voices. Use F0 only for development.
- **Candidate voices for the blind test:**
  - Japanese: `ja-JP-NanamiNeural` / `KeitaNeural` / `AoiNeural`
  - German: `de-DE-KatjaNeural` / `ConradNeural` / `SeraphinaMultilingualNeural`
  - English: `en-IN-NeerjaNeural` / `ArjunNeural`, or an en-US voice (product decision)
- If the Japanese tutor speaks English a lot, include `ja-JP-MasaruMultilingualNeural` in the test.
- Run synthesis server-side via the SDK and stream audio plus viseme events to the client. Alternatively use the browser SDK with 10-minute tokens.
- **Don't** use `DragonHDLatestNeural` for characters: it has no visemes or prosody rate, floats to the latest model, and has deliberate variation.

**Main risks:**
- Standard neural voices may sound less natural or expressive than ElevenLabs. That is a learner-engagement risk the blind test must quantify.
- Viseme support for ja-JP is documented inconsistently.

### 11.2 Alternative A: ElevenLabs, if it wins the blind test decisively

- **Plan:** buy **Starter ($6/month; $1 first month under the current promo)**.
  - It is the cheapest plan with a **commercial licence**. Free forbids commercial use and requires attribution.
  - It has concurrency 6 for Flash, 3 for Multilingual v2, and 21 Text-to-Dialogue sessions for v4/v3.
  - It gives access to PAYG top-ups at the **same per-character API rate as every higher tier**. Enable 2FA to lift the $100/month PAYG purchase cap.
- **Does Starter suffice?**
  - **Feature-wise, yes**, for MVP traffic.
  - **Volume-wise, no.** Its included usage covers only ~75 EN sessions on Flash or ~37 on v4. Everything above that is PAYG at $0.04–0.08/1K.
  - **Creator ($22) only adds value** if you need 192 kbps MP3, more concurrency (10 Flash), or more voice slots. Its included usage is the same dollars-for-chars deal.
  - Pro (44.1 kHz PCM, 20 concurrency) is not justified at this scale.
- **Model:**
  - **`eleven_flash_v2_5`** ($0.04/1K, ~75 ms, TTS WebSocket with alignment, `speed` 0.7–1.2, stitching supported). Use it with `language_code`, a fixed seed and fixed settings.
  - Or **`eleven_v4_turbo`** ($0.04/1K) if it sounds clearly better. It requires the Text-to-Dialogue WebSocket and has **no speed setting**, so Slow must be client-side.
  - Avoid `eleven_v4` / v3 / Multilingual v2 at $0.08/1K unless budget allows.
- **Voices:** pick library voices whose `verified_languages` include your model and whose **notice period is ≥ 365 days**, or create your own voice.
- **Japanese readings:** alias dictionary built from LLM ruby output, plus `apply_language_text_normalization` if latency allows.

### 11.3 Alternative B: Google Cloud TTS

- **Neural2** if you want SSML `<mark>` timepoints and `yomigana` phonemes at $16/1M with 1M free.
- **Chirp 3 HD** if it sounds best ($30/1M, 1M free). It has no timing data, so use the amplitude lip-sync fallback, and no SSML on streaming.
- WaveNet ($4/1M, 4M free) is the cheapest native-voice fallback. At 1,000 sessions/month it costs ~$0.

### 11.4 Lock-in risk

- **The character's voice *is* the provider.** Switching providers changes the persona's voice, which learners will notice. A cloned voice (ElevenLabs IVC/PVC, Azure Custom/Personal Voice, Cartesia clone) is still bound to that vendor's model.
- **Mitigations** (ASSUMPTION / design):
  - a thin `TtsProvider` interface (text + language + voice config in; audio + normalised timing events out)
  - store provider-neutral ruby annotations rather than provider SSML in lesson content
  - cache audio for all static lesson content so it survives a provider switch or voice removal
  - choose your own designed voice, or library voices with long notice periods
  - pin model IDs and voice names, and re-run the §7 regression suite before accepting any model upgrade
- **Vendor-specific risk notes:**
  - ElevenLabs: "may remove any voice at any time" [S26]; deprecates models [S3]; pricing changed twice in 2026 [S1][S40].
  - Azure: HD "Latest" models float [S36].
  - OpenAI: snapshot behaviour changes [S33].

### 11.5 Blind listening-test plan (run before buying anything beyond $6 Starter or $5 Cartesia Pro)

**Budget/time:** about 1 day of preparation and about $10 of API usage. Use the Azure F0, Google free tier, ElevenLabs Free (non-commercial internal evaluation is fine), and the Deepgram $200 credit.

1. **Candidates:**
   - Japanese: 2 Azure standard voices, 2 ElevenLabs library voices (Flash v2.5 and v4 Turbo), 1 Google Chirp 3 HD, 1 Google Neural2
   - optionally Cartesia Sonic 3.6 and Deepgram Aura-2
   - the same pattern for German and English
   - for each candidate, fix all settings and record them
2. **Stimuli:** about 12 lines per language from the §7.1 corpus: 4 tutor turns, 2 mixed-language, 2 numbers/dates, 2 kanji-ambiguity (ja) or compounds (de), 1 short, 1 long. Loudness-normalise all clips (e.g., −23 LUFS) and strip identifying silences or artefacts.
3. **Raters per language:**
   - **≥ 3 native speakers** for nativeness and pronunciation (friends, language-exchange partners, or a paid rater platform)
   - **≥ 3 target learners (Indian adults)** for intelligibility and likeability
4. **Procedure:**
   - Use a simple web form or spreadsheet with randomised, provider-blind clip IDs (e.g., A–F, shuffled per rater).
   - **Task 1, MOS (1–5):** naturalness, accent nativeness, pronunciation correctness (native raters also mark any misread word).
   - **Task 2, MUSHRA-lite:** all candidates for the same sentence side by side, rated 0–100, with a hidden reference if you have a human recording. Optional.
   - **Task 3, consistency:** pairs of clips from the same candidate (different sentences or repeated generations) mixed with pairs from different candidates. Question: "Same speaker? yes/no/unsure".
   - **Task 4, Slow:** the same sentence as client-side 0.75× time-stretch vs provider-slow. Which is clearer and more natural?
5. **Automatic metrics on the same clips (§7.2):**
   - Whisper CER/WER
   - ECAPA similarity across 5 repeated generations (determinism)
   - morae or syllables per second
   - F0 median
   - measured time-to-first-audio from a server in or near India
6. **Decision rule** (ESTIMATE; adjust to taste):
   - Choose ElevenLabs over Azure only if its mean MOS (naturalness + nativeness) is ≥ 0.5 points higher on **both** native and learner panels, **and** its pronunciation errors are not worse.
   - Otherwise choose the cheapest candidate within 0.25 MOS of the best.
   - Reject any candidate with a "same speaker" rate below ~90% on its own pairs, or with any ja-JP kanji misread that cannot be fixed with the provider's controls.
7. **Also verify on day 1:**
   - ja-JP and de-DE viseme events in Azure
   - ElevenLabs API vs credit accounting on Starter
   - whether `eleven_v4_turbo` alignment arrives over the Text-to-Dialogue WebSocket
   - whether Azure standard voices are bit-identical across calls

---

## Sources

All accessed **2026-10-14**.

| ID | Source | URL |
|---|---|---|
| S1 | ElevenLabs API pricing (ElevenAPI tab, model prices, FAQ "billed in US dollars") | https://elevenlabs.io/pricing/api |
| S2 | ElevenLabs pricing (plans, credits, concurrency, rollover, credits per char) | https://elevenlabs.io/pricing |
| S3 | ElevenLabs Models overview (model IDs, languages, latency, deprecations, concurrency table) | https://elevenlabs.io/docs/overview/models |
| S4 | ElevenLabs Models overview, concurrency section (same page as S3) | https://elevenlabs.io/docs/overview/models |
| S5 | ElevenLabs Eleven v4 capability doc (native accent handling, no Speed/Style/SSML) | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md |
| S6 | ElevenLabs "Introducing Eleven v4" page (latency, FAQ: SSML break disabled, competitor latency chart) | https://elevenlabs.io/v4 |
| S7 | ElevenLabs API reference: Create speech with timing (params, alignment, retention flag) | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps |
| S8 | ElevenLabs Request stitching guide | https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching |
| S9 | ElevenLabs help: Can I publish the content I generate? (free plan non-commercial + attribution) | https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform |
| S10 | ElevenLabs Pronunciation best practices (phoneme tags only `eleven_flash_v2`, dictionaries, break tags, normalisation) | https://elevenlabs.io/docs/best-practices/prompting/pronunciation |
| S11 | ElevenLabs Zero Retention Mode (Enterprise) | https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode |
| S12 | ElevenLabs Billing doc (plans; free = non-commercial with attribution) | https://elevenlabs.io/docs/overview/administration/billing.md |
| S13 | ElevenLabs Pay As You Go | https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md |
| S14 | ElevenLabs help: What is usage based billing? (legacy) | https://elevenlabs.io/docs/help-center/account/general/what-is-usage-based-billing.md |
| S15 | ElevenLabs help: What happens when I run out of credits? | https://elevenlabs.io/docs/help-center/account/general/what-happens-when-i-run-out-of-credits.md |
| S16 | ElevenLabs help: Pay in INR | https://elevenlabs.io/docs/help-center/account/payment-billing/can-i-pay-for-my-eleven-labs-subscription-in-inr.md |
| S17 | ElevenLabs: Text to Speech vs Text to Dialogue WebSockets | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets.md |
| S18 | ElevenLabs changelog (v4 launch 2026-09-28; agent default change 2026-10-05) | https://elevenlabs.io/docs/changelog |
| S19 | ElevenLabs: Understanding latency | https://elevenlabs.io/docs/eleven-api/concepts/latency.md |
| S20 | Azure Retail Prices API (Azure Speech meters, eastus) | https://prices.azure.com/api/retail/prices?$filter=armRegionName eq 'eastus' and contains(meterName,'Neural') |
| S21 | Azure Speech pricing page (F0: 0.5M neural chars/month; prices shown as placeholders) | https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/ |
| S22 | Azure Speech quotas and limits | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits |
| S23 | Azure language and voice support (TTS voices, viseme locales, footnotes) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts |
| S24 | Azure: Get facial position with viseme | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme |
| S25 | Azure Text to speech overview (billable characters; kanji ×2; viseme "en-US only" statement) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech |
| S26 | ElevenLabs Voice Library Addendum | https://elevenlabs.io/vla |
| S27 | ElevenLabs public shared-voices API (direct query, `language=ja` / `de`, top 3) | https://api.elevenlabs.io/v1/shared-voices?page_size=3&language=ja&sort=usage_character_count_1y |
| S28 | OpenAI Text-to-speech guide | https://developers.openai.com/api/docs/guides/text-to-speech |
| S29 | OpenAI API reference: Create speech | https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create |
| S30 | OpenAI pricing | https://developers.openai.com/api/docs/pricing |
| S31 | OpenAI community: gpt-4o-mini-tts pricing (~$0.015/min estimate) | https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816 |
| S32 | OpenAI community: gpt-4o-mini-tts ignoring speed parameter | https://community.openai.com/t/new-tts-model-gpt-4o-mini-tts-ignoring-speed-parameter/1154883 |
| S33 | OpenAI community: gpt-4o-mini-tts voice inconsistency between requests | https://community.openai.com/t/gpt-4o-mini-tts-voice-inconsistency-between-requests/1224969 |
| S34 | OpenAI community: Unnatural speech in Japanese TTS with long paragraphs | https://community.openai.com/t/unnatural-speech-in-japanese-tts-with-long-paragraphs-e-g-gpt-4o-mini-tts-tts-1/1149028 |
| S35 | Azure SSML phonetic alphabets (ja-JP kana phone set; kana→viseme) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets |
| S36 | Azure HD voices (SSML support table, temperature, Latest model, latency) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| S37 | Azure SSML pronunciation (phoneme, custom lexicon, say-as, sub) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-pronunciation |
| S38 | Azure TTS REST reference (token valid 10 min) + Microsoft Q&A on browser token broker | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech ; https://learn.microsoft.com/en-us/answers/questions/5552241/how-to-securely-use-azure-speech-services-in-spa-a |
| S39 | Azure TTS data, privacy and security | https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security |
| S40 | Secondary: mid-2026 ElevenLabs API rates ($0.05/$0.10), e.g. Puter tutorial (Jun 2026), omidsaffari.com | https://developer.puter.com/tutorials/elevenlabs-api-pricing/ ; https://omidsaffari.com/blog/elevenlabs-pricing |
| S41 | ElevenLabs API reference: Stream speech with timing | https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps |
| S42 | Secondary (JP): ElevenLabs Japanese review articles (v3 kanji/intonation improvements) | https://ai.giftx.co.jp/blog/elevenlabs-japanese/ |
| S43 | DevelopersIO (Classmethod), 2026-04-16: ElevenLabs Pronunciation Dictionary Japanese workaround | https://dev.classmethod.jp/articles/elevenlabs-pronunciation-dictionary-japanese-fallback/ |
| S44 | ElevenLabs API reference: TTS WebSocket stream-input | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input |
| S45 | ElevenLabs API reference: Stream dialogue with timestamps | https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream-with-timestamps.md |
| S46 | ElevenLabs docs index (Forced Alignment API exists) | https://elevenlabs.io/docs/llms.txt |
| S47 | ElevenLabs TTS best practices (speed 0.7–1.2, normalisation) | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices.md |
| S48 | Google Cloud Text-to-Speech pricing | https://cloud.google.com/text-to-speech/pricing |
| S49 | Google Chirp 3: HD voices doc | https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd |
| S50 | Google Cloud TTS SSML doc (timepoints, `yomigana`) | https://docs.cloud.google.com/text-to-speech/docs/ssml |
| S51 | Cartesia pricing | https://cartesia.ai/pricing |
| S52 | Cartesia latest TTS models (Sonic 3.6, snapshots, languages) | https://docs.cartesia.ai/build-with-cartesia/tts-models/latest |
| S53 | Cartesia example: SSE with phoneme timestamps | https://docs.cartesia.ai/examples/tts-sse-with-phoneme-timestamps.md |
| S54 | Cartesia: Volume, Speed, Emotion; Custom Pronunciations; IPA Phonemes | https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md ; https://docs.cartesia.ai/build-with-cartesia/capability-guides/custom-pronunciations.md ; https://docs.cartesia.ai/build-with-cartesia/capability-guides/phonemes.md |
| S55 | Deepgram pricing | https://deepgram.com/pricing |
| S56 | Deepgram TTS models (Aura-2 languages and voices) | https://developers.deepgram.com/docs/tts-models |
| S57 | ElevenLabs help: Why does my voice change accent or language? | https://elevenlabs.io/docs/help-center/troubleshooting/why-does-my-voice-change-accent-or-language.md |
| S58 | ElevenLabs help: Can I use the same cloned/designed voice across languages? | https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-use-the-same-cloned-designed-voice-across-languages.md |
| S59 | OpenAI Whisper repository | https://github.com/openai/whisper |
| S60 | SpeechBrain ECAPA-TDNN speaker model card | https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb |
| S61 | Resemblyzer repository | https://github.com/resemble-ai/Resemblyzer |
| S62 | ITU-T P.800 (Methods for subjective determination of transmission quality) | https://www.itu.int/rec/T-REC-P.800 |
| S63 | ITU-R BS.1534-3 (MUSHRA) | https://www.itu.int/rec/R-REC-BS.1534 |
| S64 | MDN: HTMLMediaElement.preservesPitch | https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch |
| S65 | Secondary (JP): announcer speech-rate norms of 300–350 / 400 chars per minute (search results; agora-web, itmedia blog, gendai.media) | https://agora-web.jp/?p=228481 ; https://blogs.itmedia.co.jp/nagaichika/2015/03/post_98.html ; https://gendai.media/articles/-/42472 |
| S66 | Pellegrino, Coupé & Marsico (2011), "A Cross-Language Perspective on Speech Information Rate", *Language* 87(3); summarised in arXiv 2407.06596 (Japanese ~8 syllables/s) | https://www.cambridge.org/core/journals/language/article/abs/crosslanguage-perspective-on-speech-information-rate/73064B3F77E7CE81C42CAB29B4393F80 ; https://arxiv.org/pdf/2407.06596 |

**Not verified / gaps:**
- the exact per-language syllable-rate table in Pellegrino 2011 (paper not retrieved)
- Google voice-family support for `<mark>` timepoints
- Deepgram and Gemini TTS timestamp support
- Cartesia phoneme-timestamp language coverage
- the meaning of the ElevenLabs shared-voice `rate` field
- Azure MAI-Voice-2 pricing
- whether Azure standard neural output is deterministic
- whether ElevenLabs India residency endpoints are self-serve
