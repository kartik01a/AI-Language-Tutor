# Research notes: avatar rendering, lip-sync and Japanese text display

- **Status:** research input for planning. This note does not decide anything.
- **Author:** research analyst (AI). **Date / access date for every source:** 2026-10-14.
- **Scope:** the seven research questions in the brief: visemes, viseme timing per TTS, 2D rendering, alternative tools and licences, SVG authoring, Japanese furigana and romaji, and asset budgets.
- **Labels:**
  - **VERIFIED** means I read it on an official or primary source (docs, licence page, repo, npm registry metadata, or a package's source code), or measured it myself in a scratch test.
  - **REPORTED** means it comes from a secondary source (forum, bug tracker, blog, aggregator or search summary).
  - **ESTIMATE / ASSUMPTION** means it is my own engineering judgement and has not been measured on target devices.
- **Citations:** `[S#]` refers to the numbered list in [Sources](#sources). All sources were accessed on 2026-10-14.

---

## 0. TL;DR

1. **The chosen direction holds up.** Use a layered inline SVG rig, driven by a small custom `requestAnimationFrame` controller behind a `setState / setExpression / setViseme / blink` interface. This is the cheapest, most crisp and most debuggable option for a hand-drawn cartoon on mid-range phones. No animation library is required. Motion's ~2.3 KB mini `animate()` [S20] or GSAP (now free, 28 KB gz measured) [S18][S19] are optional extras.
2. **The Rive premise needs correcting.** Since Oct 2025 Rive said exports moved to paid plans [S15], and the docs still say "Exporting for runtime is available on paid plans" [S16]. **But the live pricing page today says the Free plan can "Export .riv files with a splash screen"** [S14] (VERIFIED in the page HTML). Cadet is "$9 /seat/mo" and removes the splash. The blog gives $9/month billed annually or $17/month billed monthly [S15]. A Rive splash screen in a tutor UI is not acceptable for production, so **for product use, Rive still means Cadet (≥ $108/seat/yr).** The sources conflict, so re-check before buying.
3. **Use one mouth set: 10 shapes.** It is Rhubarb's A–H + X with separate vowel shapes for A, I, U, E and O. These five vowels match Japanese, VRM (`aa/ih/ou/ee/oh`) [S34] and Live2D conventions, so upgrading later is easy. Mapping tables are in §1.
4. **Timing source for each TTS:**
   - **Azure:** viseme IDs for en, de and ja (ja-JP gets viseme ID only, no blend shapes) [S2]. Two caveats:
     - The SDK delivers them as events; the REST API does not (REPORTED) [S5].
     - The HD/Dragon voices do not support the `<mstts:viseme>` SSML element [S4]. Whether they still emit viseme-ID events is **unverified, so test it**.
   - **ElevenLabs:** character-level `alignment` / `normalized_alignment` [S9][S10]. Convert characters to visemes with grapheme rules (en/de) or a kana reading (ja).
   - **OpenAI:** audio only, with no timing data [S11].
   - **Google:** SSML `<mark>` timepoints only [S12]. Chirp 3 HD does not list `<mark>` and ignores unlisted tags [S13].
   - **Fallback for everything:** audio analysis. Best practice is to decode the clip to PCM, precompute an envelope/viseme track, and schedule it against `AudioContext.currentTime`. This avoids live `createMediaElementSource` analysis, which has a history of iOS Safari bugs (REPORTED) [S58].
5. **Japanese text.** Run the readings pipeline server-side (Node route handler or worker), never in the browser: the kuromoji IPADIC dictionary is ~17 MB gzipped (VERIFIED by measurement).
   - **kuroshiro + kuromoji** was revived in 2026 (1.2.1 and 2.0.0-beta.2, released 2026-10-05) [S45][S59]. It outputs `<ruby>` HTML directly, and its Hepburn mode handles particles は→wa and を→o (VERIFIED in my test).
   - **Known errors I reproduced:** 一日中 → いちにち**ちゅう** (should be じゅう), the greeting 今日は → きょうは, and Arabic numerals get no reading.
   - **Recommendation:** analyzer first, plus a lesson-content override dictionary, plus an optional LLM check on flagged tokens only.
6. **Fonts.** Noto Sans JP from Google Fonts is served as **124 unicode-range slices per weight**. In my sample these were 8–90 KB each, and the kana slice is ~79 KB (VERIFIED). `next/font/google` self-hosts it [S52]. Use `preload: false` for JP and let unicode-range slicing do the work.
7. **Budget per character SVG:** ≤ 25 KB brotli/gzip (≤ 80 KB minified raw) and ≤ 300 elements. Use no filters, masks or embedded rasters, and no `<text>`. The asset contract is in §9.

---

## 1. Viseme standards and the recommended cartoon set

### 1.1 Reference sets (VERIFIED)

**Microsoft Azure: 22 viseme IDs (0–21)** [S1]. Each event carries `VisemeId` and `AudioOffset` in ticks (100 ns; divide by 10,000 for ms).

| ID | IPA (en-US reference) | ID | IPA |
|---|---|---|---|
| 0 | silence | 11 | aɪ |
| 1 | æ, ə, ʌ | 12 | h |
| 2 | ɑ | 13 | ɹ |
| 3 | ɔ | 14 | l |
| 4 | ɛ, ʊ | 15 | s, z |
| 5 | ɝ | 16 | ʃ, tʃ, dʒ, ʒ |
| 6 | j, i, ɪ | 17 | ð |
| 7 | w, u | 18 | f, v |
| 8 | o | 19 | d, t, n, θ |
| 9 | aʊ | 20 | k, g, ŋ |
| 10 | ɔɪ | 21 | p, b, m |

Azure documents per-locale phoneme→viseme tables [S3]. Notable details:
- **ja-JP** is keyed by katakana:
  - vowels: ア(…,2), イ(6), ウ(…,6), エ(…,4), オ(…,8)
  - ン → 19
  - マ行 onsets → 21, カ行 → 20, サ → 15, シ/チ → 16, ハ行 → 12
  - ツ → (19,15,6)
  - Azure maps Japanese **u to 6**, the spread-lip ID, because Japanese /ɯ/ is unrounded.
  - There is **no entry for っ (sokuon)**.
- **de-DE** uses IPA and SAPI symbols:
  - `aː/a` → 2, `ɔ` → 3, `ɛ/ɛː/e/œ/ʊ/yː` → 4, `ə/øː` → 1, `iː/ɪ` → 6, `o/oː` → 8, `uː/ʏ` → 7
  - diphthongs `ai` → 2,6; `au` → 2,7; `ɔʏ` → 3,4
  - `pf` → 21,18; `ts` → 19,15; `ʁ/r` → 13; `x/ç` → 12; `ʔ` → 19

Azure's German table puts some front rounded vowels under spread or neutral IDs, for example `yː` → 4. A cartoon rig should override this (see §1.4).

**Meta / Oculus OVRLipSync: 15 visemes** [S6] are `sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U`. The page carries a "no longer being updated" notice. These are also the 15 names that **wawa-lipsync** outputs (VERIFIED in its source) [S8].

**Rhubarb Lip Sync / Preston Blair-style: 6 basic + 3 extended shapes** [S7]:
- **A:** closed (P B M)
- **B:** slightly open, teeth clenched (most consonants such as K S T, and EE)
- **C:** open (EH, AE; also an in-between)
- **D:** wide open (AA)
- **E:** slightly rounded (AO, ER; an in-between towards F)
- **F:** puckered (UW, OW, W)
- **G** (optional): F/V, upper teeth on the lower lip
- **H** (optional): long L, tongue raised
- **X** (optional): idle/rest

### 1.2 Recommended set: 10 mouth shapes (ESTIMATE / design recommendation)

The set is designed for a cartoon. Japanese is vowel-driven, so the five vowels get their own shapes; these vowel shapes also map directly to VRM's `aa/ih/ou/ee/oh` [S34] and to common Live2D vowel parameters.

| Our ID | Description (draw) | Rhubarb | Oculus | Typical sounds |
|---|---|---|---|---|
| `rest` | Lips closed, relaxed, slight smile allowed | X | sil | silence, pauses |
| `mbp` | Lips pressed together (slightly rolled in) | A | PP | p b m; Japanese ma/ba/pa onsets; ん before m/b/p |
| `cons` | Slightly open, teeth together or visible | B | DD, kk, SS, nn, CH | t d n s z k g h j ʃ tʃ ʒ dʒ ŋ ç x ʁ ts |
| `a` | Wide open, jaw dropped | D | aa | a, aː, ɑ, ʌ (stressed) |
| `i` | Spread, small opening, teeth visible | (B) | I | i, iː, ɪ, j onset |
| `u` | Small rounded pucker | F | U | u, uː, ʊ, w; German ü (y, ʏ); Japanese う (stylised) |
| `e` | Mid open, slightly wide | C | E | e, ɛ, æ, ə |
| `o` | Rounded, medium open | E | O | o, ɔ, ɝ/ER, German ö (ø, œ) |
| `fv` | Upper teeth on lower lip | G | FF | f, v, (German pf release) |
| `l_th` | Open like `e`, tongue tip visible behind upper teeth | H | TH, (nn for l) | l, θ, ð |

Implementation notes (ESTIMATE):
- **Rendering mode:** show exactly one mouth group at a time (discrete swap). Use a 40–60 ms minimum hold; drop visemes shorter than one frame (16.7 ms), or merge them into their neighbour.
- **In-betweens:** use Rhubarb's in-between logic [S7]. When jumping `rest/mbp` → `a`, insert `e` for one frame. When jumping `a` → `u`, insert `o`.
- **Diphthongs** (aɪ, aʊ, ɔɪ, eɪ, oʊ, German ai/au/ɔʏ): split the span at about 60/40 between the two vowel shapes.
- **Japanese `u` choice:** Azure's `u` → 6 is phonetically right but reads oddly in a cartoon. Use our `u` with a smaller pucker, or set a per-character flag to use `i`.

### 1.3 Table (a): Azure viseme ID → our set

| Azure ID | → ours | Note |
|---|---|---|
| 0 | `rest` | |
| 1 (æ ə ʌ) | `e` | For de-DE ID 1 also covers øː: override to `o` if the phoneme is known. Otherwise accept `e`. |
| 2 (ɑ) | `a` | |
| 3 (ɔ) | `o` | |
| 4 (ɛ ʊ) | `e` | de-DE also maps yː, œ, ʊ here; acceptable. |
| 5 (ɝ) | `o` | |
| 6 (j i ɪ) | `i` | ja-JP uses 6 for う: optionally remap to `u` when locale = ja and the preceding kana is a u-column mora (needs text). |
| 7 (w u) | `u` | |
| 8 (o) | `o` | |
| 9 (aʊ) | `a` → `u` | Split 60/40 over the event duration. |
| 10 (ɔɪ) | `o` → `i` | |
| 11 (aɪ) | `a` → `i` | |
| 12 (h) | `cons` | Or hold the next vowel's shape at 50% (coarticulation). Japanese ハ行 also arrives as 12, and so does German x/ç. |
| 13 (ɹ) | `o` for en; `cons` for de | English r is lip-rounded. German ʁ is not (per-locale override). |
| 14 (l) | `l_th` | |
| 15 (s z) | `cons` | |
| 16 (ʃ tʃ dʒ ʒ) | `cons` | Optionally a "rounded cons" variant later. |
| 17 (ð) | `l_th` | |
| 18 (f v) | `fv` | |
| 19 (d t n θ) | `cons` | Azure groups θ here; also used for ン and ʔ. |
| 20 (k g ŋ) | `cons` | |
| 21 (p b m) | `mbp` | |

### 1.4 Table (b): English and German phonemes → our set

**English (ARPAbet as in CMUdict; IPA in brackets)**

| Phoneme | → ours | Phoneme | → ours |
|---|---|---|---|
| AA [ɑ] | `a` | B, M, P | `mbp` |
| AE [æ] | `e` (stressed → `a` optional) | F, V | `fv` |
| AH0 [ə] | `e` | TH [θ], DH [ð] | `l_th` |
| AH1 [ʌ] | `a` | L | `l_th` |
| AO [ɔ] | `o` | W | `u` |
| AW [aʊ] | `a`→`u` | R [ɹ] | `o` (light) |
| AY [aɪ] | `a`→`i` | Y [j] | `i` |
| EH [ɛ] | `e` | CH, JH, SH, ZH | `cons` |
| ER [ɝ] | `o` | S, Z, T, D, N | `cons` |
| EY [eɪ] | `e`→`i` | K, G, NG | `cons` |
| IH [ɪ], IY [i] | `i` | HH | `cons` (or next vowel at 50%) |
| OW [oʊ] | `o`→`u` | silence / pause | `rest` |
| OY [ɔɪ] | `o`→`i` | | |
| UH [ʊ], UW [u] | `u` | | |

**German (IPA)**

| Phoneme(s) | → ours | Phoneme(s) | → ours |
|---|---|---|---|
| a, aː | `a` | p, b, m | `mbp` |
| ɛ, ɛː, e, eː | `e` | pf | `mbp`→`fv` |
| ə, ɐ | `e` (small) | f, v | `fv` |
| ɪ, iː, j | `i` | t, d, n, s, z, ts | `cons` |
| ʏ, yː (ü) | `u` | ʃ, tʃ, ʒ, dʒ | `cons` |
| ø, øː, œ (ö) | `o` | ç, x, h | `cons` |
| ʊ, uː | `u` | k, g, ŋ | `cons` |
| ɔ, o, oː | `o` | l | `l_th` |
| ai (ei) | `a`→`i` | ʁ, r | `cons` |
| au | `a`→`u` | ʔ (glottal stop) | `rest` (1 frame) |
| ɔʏ (eu, äu) | `o`→`i` | | |

**Grapheme heuristics** (needed for ElevenLabs, which gives characters, not phonemes). ESTIMATE, good enough for a cartoon:
- **German:**
  - multi-letter sequences first: `sch tsch ch ck ng pf ph qu ei ai ey au eu äu ie ah eh oh uh ee aa oo`
  - then single letters, with `ä`→`e`, `ö`→`o`, `ü`→`u`, `ß`→`cons`, `w`→`fv` (German w = /v/), `v`→`fv`, `z`→`cons`
- **English:** look up CMUdict first (BSD-style licence, VERIFIED [S60]; the npm `cmu-pronouncing-dictionary` is ISC [S59]). For out-of-vocabulary words, use letter rules (`th`→`l_th`, `sh/ch`→`cons`, `oo`→`u`, `ee`→`i`, `ph`→`fv`, `wh/w`→`u`).
- **Licensing caution for G2P:** espeak-ng is **GPL-3.0** (VERIFIED [S60]). `phonemizer.js` is Apache-2.0 but wraps eSpeak NG [S60], so it effectively ships GPL code. Avoid it in the client bundle, and keep it server-only if it is used at all.

### 1.5 Table (c): Japanese kana / mora → our set

Japanese is mora-timed. For lip-sync, the vowel of each mora dominates; the onset consonant takes roughly the first 25–35% of the mora (ESTIMATE). For cartoon simplicity you may skip `cons` onsets entirely and animate vowels plus closures only.

| Mora type | Onset shape (≈30%) | Body (≈70%) | Notes |
|---|---|---|---|
| あ い う え お | — | `a` `i` `u` `e` `o` | |
| か/が, さ/ざ, た/だ, な, ら, や-row, は-row (not ふ) + vowel | `cons` | vowel | ち, つ, し, じ also `cons` onset |
| ま/ば/ぱ-row + vowel | `mbp` | vowel | the closure must show, as it is the most visible cue |
| ふ (ɸu) | `u` | `u` | bilabial, **not** `fv` |
| わ | `u` | `a` | を → `o` |
| きゃ/しゅ/ちょ… (yōon) | `cons` + brief `i` glide | `a`/`u`/`o` | |
| ん (moraic N) | — | before m/b/p → `mbp`; utterance-final → `rest`; otherwise `cons` (half-open) | Azure maps ン → 19 (`cons`) |
| っ (sokuon) | — | hold the **next** consonant's closure: `mbp` before p, else `cons` (silent hold) | Azure table has no entry; treat as a closure lasting one mora |
| ー (chōonpu) | — | extend the previous vowel | |
| Long vowels (おう, えい, ああ) | — | single held vowel shape | |
| Devoiced vowels (す in です/ます, し in ました) | `cons` | `cons` or a very short vowel | |
| Punctuation 、。！？ | — | `rest` | |

### 1.6 Coarticulation and timing rules (ESTIMATE)

- Look ahead about 30–50 ms. A closure (`mbp`, `fv`) should be fully formed **at** its audio onset, not after it.
- Never skip `mbp`. It is the most noticeable lip-sync error.
- At syllable rates above about 8/s (fast TTS), collapse runs of `cons` into the neighbouring vowel.

---

## 2. Getting viseme timing for each TTS option

### 2.1 Azure Speech: native viseme events (VERIFIED unless noted)

- **API:** subscribe to `VisemeReceived` (JS: `synthesizer.visemeReceived`). The event gives `visemeId` and `audioOffset` in 100 ns ticks; an `animation` string appears only when SVG or blend shapes are requested via SSML `<mstts:viseme>` [S1].
- **Locales:** `de-DE`, `de-AT`, `de-CH`, `en-GB` and other English locales get **Viseme ID + Blend shapes**. `en-US` adds **SVG**. `ja-JP` gets **Viseme ID only** [S2]. Some voices (footnote 3, for example si-LK, sw-KE, yue-CN) support no visemes [S2].
- **SDK only:** viseme events come through the Speech SDK, not the REST API. This is REPORTED in a Microsoft Q&A answer [S5]. Docker containers do not support visemes (REPORTED [S5]).
- **HD voices:**
  - `<mstts:viseme>` is listed as **not supported** for DragonHD and Dragon HD Omni [S4]. Whether plain viseme-ID events still fire on HD voices is **UNVERIFIED**. Test it before committing to an HD voice; standard neural voices are the safe choice.
  - Both HD and standard voices are documented at "less than 300 ms" latency [S4].
  - HD voices include `ja-jp-Masaru/Nanami`, `de-de-Florian/Seraphina` and many `en-us` voices [S4].
- **Recommended architecture:**
  1. A server route handler runs the SDK (Node) and collects audio chunks and viseme events.
  2. It streams both to the client over SSE/WebSocket (or returns `{audioUrl, visemes:[{t_ms,id}]}` for non-streamed turns).
  3. The client maps IDs with table 1.3.

  This keeps keys off the client. (The JS SDK can also run in the browser with a short-lived auth token; this is a design option and not evaluated further here.)
- **Latency:** no official figure for how far viseme events lead or lag audio chunks (UNVERIFIED). Because events carry absolute audio offsets, sync quality depends only on the client clock and scheduling (§2.6).

### 2.2 ElevenLabs: character-level alignment (VERIFIED)

- **Endpoints:** `POST /v1/text-to-speech/{voice_id}/with-timestamps` returns `audio_base64`, `alignment` and `normalized_alignment`. Each alignment has `characters[]`, `character_start_times_seconds[]` and `character_end_times_seconds[]` [S9].
- **Streaming:** the `stream/with-timestamps` variant returns the same per chunk [S10].
- **Japanese option:** `apply_language_text_normalization` is "currently supported only for Japanese" and "can significantly increase request latency" [S10].
- **Converting characters to visemes:**
  - **en/de:** group characters into words using the alignment. Get phonemes (CMUdict for en; rule-based graphemes for de, §1.4) and spread them across the word span in proportion to typical phoneme durations (vowels about 2× consonants). Use `normalized_alignment` when numbers or abbreviations were expanded.
  - **ja: kanji problem.** If the input contains kanji, `characters` will be kanji, and a kanji's time span covers several morae. Three options:
    1. **Feed kana to TTS** (fits A1, where the transcript is kana anyway). Alignment characters are then morae and map directly with table 1.5. Risk (ESTIMATE): kana-only input can hurt prosody/pitch accent and word-boundary decisions. A/B test with native-speaker review.
    2. **Feed kanji + reading map (recommended for A2+).** The server runs the morphological analyzer on the same text used for TTS. For each token: span = [first char start, last char end] from alignment; reading = analyzer's kana; split the span evenly across the reading's morae (`っ` and `ー` count as morae). Mismatches between the analyzer's reading and what the TTS actually said are visually minor for lip-sync, but they matter for furigana (§6).
    3. **Check whether `normalized_alignment` returns kana** when `apply_language_text_normalization=true`. This is **UNVERIFIED**; test it, because it could remove the analyzer from the lip-sync path.

### 2.3 OpenAI TTS: no timing data (VERIFIED)

The guide describes audio output only: models `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`; formats mp3, opus, aac, flac, wav, pcm (24 kHz 16-bit LE); streaming via chunked transfer [S11]. The page mentions no timestamps or visemes. Lip-sync must therefore be audio-based (§2.5). Requesting `pcm` makes client-side analysis trivial.

### 2.4 Google Cloud TTS (VERIFIED)

- **Marks:** SSML `<mark>` plus `TimepointType = SSML_MARK` (v1beta1) gives offsets at marks only [S12]. A mark before each word gives word-level timing, which is too coarse for visemes but usable for a mouth-open envelope.
- **Chirp 3 HD:** supports SSML in synchronous requests only (Preview); unlisted tags are ignored, and `<mark>` is not listed. Treat it as having no timing; SSML is not supported for streaming [S13].
- **Conclusion:** use audio-based lip-sync.

### 2.5 Audio-based lip-sync options

| Option | Licence | Approach | Languages | Real-time? | Verdict |
|---|---|---|---|---|---|
| **wawa-lipsync** 0.0.2 (Nov 2025) [S8][S59] | MIT (VERIFIED) | `AnalyserNode` FFT (fftSize 2048). 7 hand-picked bands (50–8000 Hz), volume, spectral centroid, deltas. **Heuristic** scoring of the 15 Oculus visemes plus a hold/decay penalty (VERIFIED by reading `dist/wawa-lipsync.es.js`, ~7.5 KB unminified). | Language-agnostic heuristics, tuned on English | Yes (per rAF) | Good reference and quick win. It is pre-1.0 with one maintainer, and it uses `createMediaElementSource`, which is fragile on iOS. Fork or reimplement the ~200 lines rather than depend on it. |
| **Rhubarb Lip Sync** v1.14.0 (2025-04-03) [S7] | MIT (+ BSD/Boost/MIT deps) (VERIFIED) | Offline CLI. Speech recognition (PocketSphinx, **English only**) or a **phonetic** recognizer ("language-independent", less precise). `--dialogFile` improves results. Inputs WAV/OGG; outputs TSV/XML/JSON in A–H/X. | en (good); de/ja via phonetic | **No**: processes a file; multithreaded | Good for **pre-rendered fixed lines** (greetings, celebrations, lesson intros) generated at build time. Not for live turns. |
| **Custom amplitude + formant classifier** (Web Audio, optionally Meyda 5.6.3, MIT, last release 2024 [S61]) | yours / MIT | RMS → jaw open; F1/F2 band-energy ratios or MFCC → 5 vowels (a/i/u/e/o); zero-crossing / high-band energy → `cons`; silence → `rest`/`mbp` | Best for Japanese (5 vowels) | Yes; trivial CPU | **Recommended fallback.** Run it on decoded PCM *ahead* of playback, not live. |

**How to run audio analysis reliably (ESTIMATE, based on REPORTED platform issues):**
- Avoid live `createMediaElementSource` on iOS. WebKit has long-standing reports of MediaElementSource analysis returning silence or zeros, especially for streamed/HLS sources [S58].
- Instead, decode the TTS response with `decodeAudioData` (or assemble PCM chunks), compute a 10 ms-hop feature track off the main thread (Worker), and play it with `AudioBufferSourceNode`.
- This gives a **precomputed viseme track** you can schedule exactly, which is the same data shape as Azure/ElevenLabs. One code path then handles all TTS providers.
- **Streaming:** analyse per chunk (each chunk is ≥ 100 ms), with a 1-chunk look-ahead buffer.
- **Cost on mid-range phones (ESTIMATE):** FFT 1024 at 100 Hz hop is about 0.1–0.3 ms per frame in JS. That is negligible even on a Snapdragon 6-series or Helio G-class device.

### 2.6 Sync accuracy

- **Clock:** drive mouth selection from `audioCtx.currentTime - startTime`, not from `Date.now()` or rAF deltas.
- **Output latency:** subtract `audioCtx.outputLatency` where available (Chrome/Android 102+, Safari/iOS 18.4+) and fall back to `baseLatency` (VERIFIED in MDN browser-compat-data 8.1.5 [S51]).
  - Bluetooth headsets can add 100–300 ms (ESTIMATE). `outputLatency` may or may not reflect it, depending on the platform.
  - Add a user-adjustable "lip-sync offset" slider in settings (±200 ms).
- **Perceptual tolerance:** ITU-R BT.1359 is commonly cited as detectability ≈ +45 ms (audio leads) / −125 ms (audio lags), and acceptability ≈ +90 / −185 ms (REPORTED [S62]). Aim for the mouth to be **0–40 ms early** rather than late.
- **Frame rate:** 30 fps mouth updates are plenty; blink and idle can run at display rate.

---

## 3. 2D rendering in the browser

### 3.1 Renderer comparison (ESTIMATE unless cited)

| Criterion | **Inline SVG + CSS transforms/attributes** | Canvas 2D (draw Path2D each frame) | PixiJS v8 (WebGL/WebGPU) |
|---|---|---|---|
| Crispness | Perfect at any DPR/zoom | Must handle DPR manually; re-tessellation cost | SVG→Graphics stays vector but is "expensive to parse"; SVG→texture pixelates and is capped at 4096² [S23] |
| Authoring fit (layered SVG from Figma/Inkscape) | Native: the export *is* the rig | Needs a converter (SVG→Path2D) | `Graphics.svg()` / `parseAsGraphicsContext`. No `<text>`, filters or patterns [S23] |
| Runtime size | 0 KB (browser) + ~5–10 KB controller | ~5–10 KB | `pixi.min.js` 237 KB gz (measured, v8.22.0) |
| DOM cost | ~150–300 nodes for one character; acceptable | 1 node | 1 node |
| Per-frame cost | Each change → style + paint of the SVG subtree. Fine for ~10 animated groups at 60 fps on mid-range phones if filters/masks are avoided | Full redraw each frame; fine at this complexity | Lowest per-frame cost; startup and memory heavier |
| Debuggability | Excellent (DevTools, CSS) | Low | Medium |
| Accessibility / theming | CSS variables for colours, `prefers-color-scheme` | Manual | Manual |

- **Hardware acceleration:** Chrome says SVG animations are hardware-accelerated by default from Chromium 89 [S22]. That covers declarative animations (CSS/WAAPI on `transform`/`opacity`). JS-per-frame attribute writes still go through main-thread style and paint, so keep animated groups few and simple.
- **Recommendation:** inline SVG. Re-evaluate Canvas or Pixi only if profiling shows sustained more than 4 ms/frame for the avatar on the reference low-end device.

### 3.2 Animation libraries (VERIFIED licences and sizes)

| Library | Licence | Size | Notes |
|---|---|---|---|
| **Plain rAF** | — | ~3–6 KB own code (ESTIMATE) | Recommended: a deterministic state machine, easy to unit-test and port to Rive inputs later. |
| **Motion** (`motion` 14.2.0) | MIT [S59] | `animate()` mini 2.3 KB / hybrid 17 KB; React `motion` component ≥ 34 KB; `m` + `LazyMotion` 4.6 KB + 15/25 KB features [S20]. The feature-comparison page says 2.6 KB mini / 18 KB full [S21] (minor conflict). | Mini is WAAPI-only. Good for expression cross-fades on `opacity`/`transform`. |
| **GSAP** 3.15.0 | "Standard 'No Charge' GSAP License" [S19]. Free for commercial use, **all plugins included** (SplitText, MorphSVG) [S18][S19]. Prohibited: use in no-code visual animation builders that compete with Webflow; no reverse engineering for competing products; keep notices [S19]. | `gsap.min.js` 28 KB gz (measured) | Licence is fine for this app (not a Webflow competitor). MorphSVG could morph mouth shapes, but discrete swaps look more "cartoon" and are cheaper. Not open source (proprietary free licence). |

### 3.3 Procedural idle techniques (ESTIMATE, with research anchors)

- **Blink:**
  - **Interval:** draw the inter-blink interval from a log-normal or gamma distribution. Mean about 3.5 s idle and about 2.5 s while speaking; clamp to 1.2–8 s. 15% chance of a double blink (second one 150–250 ms later).
  - **Research anchors:** conversation blink rates range from about 15–32/min, with large individual variation (REPORTED [S57]). A cartoon looks best slightly below human rates.
  - **Duration:** about 150–200 ms: close 60 ms, hold 20–40 ms, open 90 ms (ease-out).
  - **Listening state:** use short blinks. Hömke et al. (2018) found that *long* listener blinks (607 ms vs 208 ms) made speakers give significantly shorter answers, read as a "you can stop" signal (VERIFIED [S56]).
  - **When to blink:** blink at state transitions (thinking→speaking) and on gaze shifts. Never blink during a celebration pose peak.
- **Breathing:** body/torso group `scaleY = 1 + 0.012·sin(2πt/3.6s)` with a transform origin at the hips. Shoulders translate by 0.6 px. Use a faster rate (2.8 s) when "excited".
- **Head sway:** sum two incommensurate sines (periods 7.3 s and 11.1 s, ±1.5° rotation, ±1 px translation). Add a small nod on speech stress (RMS peaks) while speaking.
- **Eye saccades:** every 1–4 s (uniform), jump the pupil target by up to 1.5 px in under 40 ms and hold. Look up-left in the "thinking" state; look at the user (centre) in "listening".
- **Expression cross-fade:** each expression is a group of eyebrow/eye/cheek variants. Cross-fade with `opacity` over 120–180 ms, or swap at a blink to hide the change (cheap and natural).
- **Mouth during non-speaking states:**
  - `happy` → `rest_smile` variant (optional extra)
  - `confused` → small offset `o`
  - `celebrating` → `a` with a larger jaw
- **`prefers-reduced-motion`** (MDN compat: Chrome 74+, Safari iOS 10.3+ [S51]). Align with the existing product spec (docs/03 §Reduced motion): keep blink and lip-sync, disable sway, breathing, bounce and particles. Expressions switch instantly or with an opacity fade of ≤ 150 ms. Also honour an in-app toggle, and pause idle loops when `document.hidden`.

---

## 4. Alternatives and licences (re-verified)

| Option | Cost (2026-10-14) | Licence / terms | Editor | Web runtime size | Viseme control | Mobile perf | Cartoon fit |
|---|---|---|---|---|---|---|---|
| **Layered SVG + code (chosen)** | $0 | Your own art | Figma free / Inkscape / Affinity (free) | ~0 + own code | Direct: toggle mouth groups | Good (ESTIMATE) | Excellent for flat cartoon |
| **Rive** | Free: export **with Rive splash screen**. Cadet $9/seat/mo (3 seats max), removes splash. Voyager $32/seat/mo [S14]. Blog: Cadet $9/mo annual, $17/mo monthly [S15]. Docs still say export is paid-only [S16]: **conflict**. | Runtimes MIT (`@rive-app/*` 2.44.2) [S59] | Rive Editor (browser/desktop) | `canvas-lite` wasm 314 KB gz; `canvas` wasm 849 KB gz (measured). `webgl2` is Rive's default recommendation; `canvas-lite` drops text/layout/audio/scripting [S17] | State machine inputs / data binding (number or enum `viseme`) | Good; Rive renderer | Excellent (mesh deform, bones) |
| **Lottie / dotLottie** | LottieFiles: Individual $19.99, Team $24.99 /user/mo annual [S25]. Lottie Creator free with **5 exports** (REPORTED [S26]). Glaxnimate free (KDE, 0.6.0, Mar 2026) [S27] | `lottie-web` 5.13.0 MIT; `@lottiefiles/dotlottie-web` 0.81.0 MIT [S59][S24] | AE + Bodymovin, Lottie Creator, Glaxnimate | `lottie_light.min.js` 46 KB gz / `lottie_svg` 62 KB gz; dotlottie wasm (ThorVG) 496 KB gz (measured) | Markers / `setSegment` / frame-per-viseme; dotLottie v2 state machines + slots (colour, scalar, vector, text, image) and themes [S24] | lottie-web SVG renderer is OK; dotLottie software renderer is wasm | Good, but runtime mouth swapping is awkward |
| **Spine** | Essential $69 (struck-through $99), Professional $379 (struck-through $449). Enterprise licence needed above $500k annual revenue [S28] | Runtimes need a Spine licence (`spine-pixi-v8` "LicenseRef-LICENSE") [S28][S59] | Spine (paid) | Spine runtime + Pixi (~237 KB gz) | Attachments / skins / animations per viseme | Very good | Good (bones, meshes) |
| **Live2D Cubism** | Editor FREE: max 100 ArtMeshes, 30 parameters, 1 texture ≤ 2048 px; commercial use only for individuals / small enterprises (annual sales < ¥10M). PRO price not shown on page [S31] | SDK: release licence needed except for individuals and small-scale enterprises, **but not exempt for "Expandable Applications"** ("significant expandability…", e.g. generating many avatars, portals) [S29][S30]. Licence must be completed ≥ 1 month before release [S29] | Cubism Editor (Win/Mac) | Cubism Core + framework + WebGL (not measured) | Mouth open/form parameters (ParamMouthOpenY / Form, standard convention) | Good | Anime 2.5D, not flat cartoon; raster texture art |
| **VRoid Studio + three-vrm** | VRoid free; "you can set your own terms of use for the data of every model… you create", including commercial use [S32] | `@pixiv/three-vrm` 3.5.5 MIT [S33][S59] | VRoid Studio (Win/Mac/iPad) | three ≈ 185 KB gz (esbuild-bundled, measured) + three-vrm 37 KB gz + model 5–20 MB (ESTIMATE) | VRM 1.0 `aa/ih/ou/ee/oh` + blink + emotions [S34] | Heavier: WebGL 3D, MToon shaders | Anime 3D style; poor fit for an original flat cartoon |

**Conclusions:**
- **Rive** remains the right upgrade path, at Cadet pricing.
- **Live2D's Expandable Application clause** is ambiguous for an AI-driven app. Seek a ruling before using it.
- **VRoid and Live2D** do not match the brief's "Duolingo-inspired, original, flat" style.

---

## 5. SVG asset authoring and export

### 5.1 Tool notes

- **Figma (free Starter):**
  - The SVG export option **"Include 'id' attribute"** makes "Figma base the 'id' on the object's name in the Layers panel" [S35].
  - The help article does not document how spaces, duplicates or special characters are transformed (REPORTED/ASSUMPTION: spaces and duplicates get altered or suffixed). **Use names that are already valid IDs** (`[a-z][a-z0-9_-]*`, unique).
  - "Outline text" converts text to paths [S35].
  - The pricing page does not explicitly list SVG export for Starter [S36]. It is widely used on free plans, but this is UNVERIFIED for 2026.
  - Pitfalls: frames export as `<g clip-path>`, so disable "Clip content" on frames. Rotations are baked as `transform` matrices. Masks become `<mask>`; avoid them.
- **Inkscape (free, GPL):**
  - Layer names live in `inkscape:label`, while `id` stays `layer1`, `g123` and so on. **Plain SVG export drops labels** (REPORTED: Inkscape bugs and issues [S39]).
  - Fix: set each group's **ID** in Object Properties or the XML editor (Ctrl+Shift+X), or run a build script that copies `inkscape:label` → `id` before SVGO.
- **Affinity (Canva):**
  - "Affinity is free for individuals (seriously)", for Windows and macOS; iPad "coming soon" [S37].
  - SVG export reportedly writes layer names into `id` (plus `serif:id`) (REPORTED [S38]).
  - The "Set viewBox" and "Flatten transforms" options exist (REPORTED). Verify in the current app.
- **Krita:** raster-first. It can export only a **single vector layer** as SVG (Layer → Import/Export → Save Vector Layer as SVG); no multi-layer document SVG export (REPORTED [S40]). **Not suitable** as the rig source, but fine for concept sketches.

### 5.2 Recommended export settings

1. **Canvas:** artboard 512×512 (or 512×640 for half-body) with the character centred; `viewBox="0 0 512 512"`, no width/height (size via CSS).
2. **Content:** all shapes as paths. No `<text>`, no `<image>` (no embedded raster), no `<filter>` (drop-shadow/blur), no `<mask>`. Avoid `<clipPath>` except for pupils inside eye whites (max 2 clipPaths), no `<pattern>`, and no `mix-blend-mode`.
3. **Shading:** bake as separate flat shapes. Use at most 2 linear gradients per character (and preferably none).
4. **Strokes:** convert to fills or use centre-aligned strokes only. Figma's "Simplify stroke" exists because SVG supports only centre strokes [S35].
5. **Transforms:** fine on groups, but every animated group needs a known pivot (§9).
6. **Precision:** 1 decimal place (2 for small facial features).

### 5.3 SVGO configuration that preserves the rig (VERIFIED plugin behaviour)

The default preset is dangerous for rigs. It contains:
- `cleanupIds`: minifies or removes IDs [S42]
- `removeHiddenElems`: **removes `display:none` and `opacity:0` elements**, which would delete your inactive mouth shapes [S43]
- `collapseGroups`: flattens groups that "effectively do nothing" [S44]
- `mergePaths`, `moveGroupAttrsToElems`, `convertShapeToPath` [S41]

```js
// svgo.config.mjs  (SVGO 4.1.0, MIT)
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,          // keep every id (rig contract)
          removeHiddenElems: false,   // keep hidden mouth/expression variants
          collapseGroups: false,      // keep rig groups even if they look redundant
          moveGroupAttrsToElems: false, // keep transforms on groups (pivots)
          moveElemsAttrsToGroup: false,
          mergePaths: false,          // keep parts separately addressable
          removeUnknownsAndDefaults: { keepDataAttrs: true, keepRoleAttr: true },
        },
      },
    },
    'removeDimensions',               // rely on viewBox; size with CSS
    { name: 'removeAttrs', params: { attrs: ['serif:id', 'data-name'] } },
  ],
};
```

Also hide inactive variants via a CSS class (`.is-off { visibility: hidden }`) applied at runtime, not via `display="none"` in the source file. This is a belt-and-braces protection.

### 5.4 Naming convention (see §9 for the full list)

- Use lowercase snake case, prefixed by part: `head`, `eye_l`, `eye_l_lid`, `mouth_a`, `brow_r`, `expr_happy`.
- `_l` / `_r` mean the **character's** left and right.
- Group IDs are unique per file. Each character file uses the same IDs, so one controller drives all three tutors.

---

## 6. Japanese text: furigana and romaji

### 6.1 Analyzer options

| Option | Licence | Status | Dictionary / size | Runs | Notes |
|---|---|---|---|---|---|
| **kuroshiro 1.2.1 / 2.0.0-beta.2 + kuroshiro-analyzer-kuromoji** | MIT [S45] | Revived: 2.0 betas (2026-09-26, 2026-10-05), Node 22+, TS types; adds `kanaToHiragana` fix [S45][S59] | Uses **kuromoji 0.1.2** (Apache-2.0, last release 2018) with IPADIC: **17 MB of .dat.gz files** (measured) | Node and browser (browser needs `dictPath`) | Modes `normal/spaced/okurigana/furigana`. `furigana` emits `<ruby>…<rp>(</rp><rt>…</rt><rp>)</rp></ruby>`. Romaji systems: `hepburn` (default), `nippon`, `passport` [S45]. Kana-only → romaji does not handle long vowels except ー [S45]. |
| **Lindera** (Rust → Wasm) 6.2.0 | MIT | Active (pushed 2026-10-13). `lindera-wasm` repo archived 2026-03-28, moved into the monorepo [S47] | IPADIC / UniDic / ko-dic / CC-CEDICT. npm `lindera-wasm-nodejs-ipadic` 13 MB, `-unidic` 47 MB unpacked [S59] | Node and web | Faster and more modern than kuromoji; you write the furigana/okurigana alignment yourself. |
| **Sudachi** (sudachi.rs v0.7.0, 2026-09-24) | Apache-2.0 [S48] | Active (Python SudachiPy) | small/core/full dicts. Official Node/Wasm binding not listed [S48]; npm `sudachi` 0.1.5 (2022, 164 MB) is stale [S59] | Python service or Rust | Best normalization and split modes (A/B/C). Would need a Python sidecar: heavier ops. |
| **MeCab** | BSD/GPL/LGPL (tri) | Mature; `mecab-wasm` npm 1.0.3 (2022, 57 MB) [S59] | IPADIC / UniDic | Native bindings / Wasm | Fast; native builds add deploy friction on serverless. |
| **WanaKana** 5.3.1 | MIT [S49] | Stable (release 2023-11; pushed 2026-06) | — (6.9 KB gz, measured) | anywhere | Kana↔romaji only. Literal "wāpuro" output: `こんにちは`→`konnichiha`, `わたしは`→`watashiha`, `とうきょう`→`toukyou`, `しんぶん`→`shinbun` (VERIFIED by running it). **Not learner Hepburn** without particle and long-vowel handling. Use it on the client for IME-style input only. |

**My kuroshiro test** (Node 22, kuroshiro 1.2.1 + analyzer 1.1.0, init 126 ms, about 1 ms per sentence, process RSS ~430 MB; VERIFIED in a scratch run):

| Input | Furigana result | Romaji (hepburn, spaced) | Correct? |
|---|---|---|---|
| 今日は東京に行きます。 | 今日(きょう)…東京(とうきょう)…行(い)きます | kyō wa tōkyō ni iki masu | ✓ (は→wa, macrons) |
| 一日中、日本語を勉強した。 | 一(いち)日(にち)中(**ちゅう**) | ichi nichi chū | ✗ should be いちにちじゅう |
| 何時ですか？ | 何(なん)時(じ) | nan ji desu ka | ✓ |
| 3時に会いましょう。 | 3 時(じ) | 3 ji … masho u | ✗ no reading for digits; split "masho u" |
| 生ビールを一つください。 | 生(なま)…一(ひと)つ | namabīru o hitotsu kudasai | ✓ |
| 今日は。 (greeting) | 今日(きょう)は | kyō wa | ✗ greeting こんにちは |
| お母さんは家にいます。 | お母(かあ)さん…家(いえ) | okāsan wa ie ni i masu | ✓ (家 could be うち: ambiguous) |

**Known accuracy issues** (VERIFIED above or REPORTED in general):
- context-dependent readings: 今日 (きょう/こんにち), 家 (いえ/うち), 何 (なに/なん), 一日 (ついたち/いちにち), 上手 (じょうず/うわて)
- rendaku (中 じゅう)
- Arabic numerals and counters (3時, 1つ)
- proper nouns
- IPADIC's age (2007 dictionary)
- romaji tokenization artifacts ("masho u", "iki masu")

### 6.2 LLM-generated readings

- **Pros:** context-aware, so it handles the greeting 今日は, numbers and counters.
- **Risks (ESTIMATE):**
  - hallucinated or misaligned readings, such as a reading for the wrong kanji span or dropped okurigana
  - inconsistency between turns
  - added latency and tokens
  - hard-to-validate free-form output
- **Mitigations:** constrain to JSON `[{surface, reading}]` where `surface` must concatenate exactly to the original text; validate that `reading` is kana-only; compare against the analyzer's output.

### 6.3 Recommended pipeline (hybrid)

1. **Server-side** (Next.js route handler on the Node runtime, or a small worker). Never in the browser, because of the 17 MB dictionary. Keep a warm singleton; ~430 MB RSS means it needs at least a 1 GB function memory setting (ESTIMATE).
2. Tokenize the tutor's text (the same string sent to TTS) → tokens with `surface`, `reading` (katakana → hiragana) and POS.
3. **Apply overrides:**
   - a curriculum dictionary (lesson vocabulary with fixed readings), and greeting phrases (`今日は`→`こんにちは`, `今晩は`)
   - a numeral+counter normaliser (3時 → さんじ, 1つ → ひとつ, 4時 → よじ)
   - rendaku-aware compounds (〜中 after time nouns → じゅう)
4. **Optional LLM check:** run it only on tokens flagged ambiguous (a small list of polyphonic words plus OOV tokens). Accept a change only if it validates.
5. **Output a structured transcript,** not HTML, so the client can toggle furigana or romaji without a server round-trip:
   ```json
   [{"s":"今日","r":"きょう","ro":"kyō","pos":"noun"},{"s":"は","r":"は","ro":"wa","pos":"particle"}, …]
   ```
   The client renders `<ruby>今日<rp>(</rp><rt>きょう</rt><rp>)</rp></ruby>`. `<ruby>`/`<rt>` are supported everywhere (Chrome 5+, Safari iOS 4.2+), and `ruby-position` needs Chrome 84+ and Safari 18.2+ [S50][S51].
6. **Toggles:**
   - A1: kana text, with romaji as a line below (or as `<rt>` over each word)
   - A2+: kanji with `<rt>` furigana. Hide with CSS `rt { visibility: hidden }` so layout does not jump; reserve line-height for the ruby.
7. **Per-character furigana:** kuroshiro attaches a reading to the whole kanji run (人生 → じんせい). Splitting per kanji requires okurigana alignment, which kuroshiro's `okurigana` mode partly handles. Word-level ruby is acceptable for learners.
8. **TTS consistency:** for ElevenLabs/Azure, the TTS's own reading can differ from the furigana. For drilled vocabulary, send kana (or SSML `<phoneme>`/`<sub alias>` for Azure; note `<phoneme>` is not supported on Dragon HD Omni [S4]) so audio and furigana agree.

### 6.4 Romaji system

- **Recommendation:** modified Hepburn with macrons (`tōkyō`, `okāsan`); particles は→wa, へ→e, を→o; ん before a vowel or y → `n'`. kuroshiro's `hepburn` already does this (VERIFIED in the test).
- **Option:** a "simple" variant with doubled vowels (`toukyou`/`tookyoo`) for typing. If used, keep the macron form as the default display.

### 6.5 Fonts

- **Noto Sans JP:** from Google Fonts' CSS API, 400+700 gives **248 @font-face rules (124 unicode-range slices per weight)**. Sample slice sizes were 8–90 KB; the hiragana/katakana slice is ~79 KB, and a short sentence pulled about 6–8 kanji slices (VERIFIED by measurement [S53]).
- **`next/font/google`** downloads the CSS and font files at build time and self-hosts them ("No requests are sent to Google by the browser") [S52]. Preloading only applies to listed `subsets`. Japanese is served through numbered unicode-range slices rather than a named `japanese` subset, so set **`preload: false`** for Noto Sans JP and use `display: 'swap'`. (Whether next/font preserves all 124 slices was not tested: ASSUMPTION; verify in build output.)
- **Load JP fonts only on Japanese screens** (route- or layout-level font call). Use one variable weight if possible (Noto Sans JP is variable; the 100..900 request returned a smaller set in my quick check, so test).
- **Alternative:** self-subset to JIS Level 1 kanji + kana (~3,000 glyphs, about 400–600 KB woff2, ESTIMATE) with `next/font/local`. Google's slicing is usually better for real-world text.
- **German / English:** one Latin variable font (for example the design system's existing family) with the `latin` + `latin-ext` subsets covers ä ö ü ß and the macron vowels ā ē ī ō ū used in romaji. Check that the chosen Latin font includes macrons (`latin-ext`).

---

## 7. Asset budgets and loading

Network reference: Lighthouse mobile "Slow 4G" is 150 ms RTT, 1.6 Mbps down, 750 Kbps up, with 4× CPU slowdown [S54]. Core Web Vitals "good": LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, at p75 [S55].

| Budget (per character) | Target | Hard cap | Rationale (ESTIMATE) |
|---|---|---|---|
| SVG minified | ≤ 60 KB | 120 KB | 25 KB brotli ≈ 125 ms on Slow 4G |
| SVG brotli/gzip | ≤ 20 KB | 40 KB | |
| Total elements | ≤ 250 | 400 | Style/paint cost and DOM size |
| `<path>` count | ≤ 150 | 250 | |
| Path commands (all) | ≤ 3,000 | 6,000 | Parse and raster cost |
| Animated groups | ≤ 12 | 20 | Per-frame style work |
| Mouth shapes | 10 (+2 optional) | — | §1.2 |
| `<clipPath>` / gradients / filters / masks | ≤ 2 / ≤ 2 / 0 / 0 | — | Mobile raster cost |
| Avatar controller JS | ≤ 8 KB gz | 15 KB | |
| Time to avatar visible | ≤ 1.0 s after FCP on Slow 4G | 2.0 s | Avatar is likely the LCP candidate |
| Frame budget for avatar | ≤ 2 ms/frame avg | 4 ms | On a reference mid-range Android |

**Caching and preloading:**
- **Active tutor:** inline the SVG into the server-rendered session page (zero extra requests; it is the LCP element), or serve it as a content-hashed static file (`Cache-Control: public, max-age=31536000, immutable`) fetched with `<link rel="preload" as="fetch">` and injected.
- **Other tutors:** lazy-fetch at idle (`requestIdleCallback`) after the session starts, or on language selection.
- Optionally use a service worker (Workbox) to precache the three character files and the avatar controller chunk.
- Precomputed Rhubarb tracks for fixed lines are small JSON (< 2 KB each); ship them with the audio.

---

## 8. Recommendations

### 8.1 Rendering

- **Primary:** inline SVG rig with a custom rAF controller (TypeScript, ~5 KB) implementing `AvatarRenderer`:
  ```ts
  interface AvatarRenderer {
    setState(s: 'idle'|'listening'|'thinking'|'speaking'|'happy'|'confused'|'celebrating'): void;
    setExpression(e: ExpressionId, opts?: { fadeMs?: number }): void;
    setViseme(v: VisemeId, weight?: number): void;   // weight reserved for Rive/3D blends
    playVisemeTrack(track: {t: number; v: VisemeId}[], clock: () => number): void;
    blink(kind?: 'short'|'long'): void;
    setReducedMotion(on: boolean): void;
    dispose(): void;
  }
  ```
  Mouth = visibility swap. Expressions = opacity cross-fade or a swap on blink. Optionally use Motion mini (MIT, 2.3 KB) for fades.
- **Alternative / upgrade:** a Rive implementation of the same interface. It needs Cadet ($9/seat/mo annual); the free tier's exports show a splash screen [S14]. Use `@rive-app/canvas-lite` (~314 KB gz wasm) or `webgl2`.
- **Fallback if SVG perf fails:** Canvas 2D drawing pre-parsed `Path2D`s from the same SVG.

### 8.2 Lip-sync timing source per TTS candidate

| TTS | Primary | Alternative |
|---|---|---|
| **Azure Speech** (standard neural voices) | Native `VisemeReceived` IDs → table 1.3. Server collects them and streams `{t, id}` with the audio. | If an HD voice is chosen and emits no visemes: word-boundary events + text→viseme (as ElevenLabs), or audio analysis |
| **ElevenLabs** | `with-timestamps` / `stream/with-timestamps` character alignment → word spans → phonemes (CMUdict / German rules) or kana morae (analyzer readings) → viseme track | Kana-only input for Japanese A1; audio analysis |
| **OpenAI TTS** | Audio analysis of decoded PCM (request `pcm`), precomputed track (amplitude + 5-vowel formant classifier) | wawa-lipsync-style heuristics live; Rhubarb offline for cached lines |
| **Google Cloud TTS** | Audio analysis (as OpenAI) | `<mark>` word timepoints on non-Chirp voices + text→viseme |
| **Pre-recorded / cached lines (any TTS)** | Rhubarb CLI at build time (`-r phonetic` for de/ja, `pocketSphinx` + `--dialogFile` for en), mapped X/A–H → ours | Same audio-analysis pipeline offline |

The single client data shape for all paths is `VisemeTrack = {t_ms: number; v: VisemeId}[]` scheduled on `AudioContext` time minus `outputLatency`, plus a user offset.

### 8.3 Furigana and romaji generation

- **Primary:** a server-side kuroshiro (1.2.x now; evaluate 2.0 when it leaves beta) + kuromoji pipeline. Add a curriculum/greeting/numeral override layer and output structured tokens (`surface`, `reading`, `romaji` (Hepburn with macrons), `pos`). Render `<ruby>` on the client with CSS toggles. Cache by text hash.
- **Alternative:**
  - Lindera (Wasm, UniDic) in Node with your own ruby alignment, for better dictionary coverage and active maintenance.
  - Or Sudachi in a Python sidecar if the backend already has Python.
  - An LLM verifies only the flagged ambiguous tokens, with strict validation.
- **Client:** WanaKana only for learner kana input (IME mode) and simple kana↔romaji toggling of already-kana text, never for learner-facing Hepburn of particles.

---

## 9. Draft technical asset contract: SVG tutor character (v0.1)

### 9.1 File

- **Format:** one SVG per character: `public/avatars/{lang}-{name}.svg` (e.g. `ja-hana.svg`), plain SVG 1.1 / SVG 2 subset.
- **Root:** `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="avatar" data-contract="1">`. No width/height and no `<style>` block: use plain presentation attributes (`fill="#…"`). If recolouring is needed, the runtime adds classes; CSS variables are not written into the file.
- **Not allowed:**
  - `<text>`, `<image>`, `<filter>`, `<mask>`, `<pattern>`, `<foreignObject>`, `<script>`, `<use>` referencing external files
  - `display="none"` (hide variants at runtime instead)
  - `mix-blend-mode`
  - more than 2 `<clipPath>` (eyes only) or more than 2 gradients

### 9.2 Required group hierarchy and IDs

Indentation means nesting. `*` marks a group that the controller animates.

```
avatar (svg root)
└─ rig                       * root transform (bounce, celebrate jump)
   ├─ shadow                 ground shadow (scaleX on jump)
   ├─ body                   * breathing scaleY (pivot: hips)
   │  ├─ torso
   │  ├─ arm_l               (static in MVP; reserved for gestures)
   │  └─ arm_r
   └─ head                   * sway/nod rotation (pivot: neck)
      ├─ head_base           face shape, hair back
      ├─ ear_l, ear_r        (optional)
      ├─ eyes
      │  ├─ eye_l
      │  │  ├─ eye_l_white
      │  │  ├─ eye_l_pupil   * saccade translate (clipped by eye_l_clip)
      │  │  ├─ eye_l_lid     * blink: scaleY 0→1 (pivot: top of eye) OR swap
      │  │  └─ eye_l_closed  closed-eye line (shown at blink peak)
      │  └─ eye_r            (same children with _r)
      ├─ brows
      │  ├─ brow_l           * expression translate/rotate
      │  └─ brow_r           *
      ├─ cheeks              blush (opacity driven by expression)
      ├─ mouth               * container (small jaw translateY allowed)
      │  ├─ mouth_rest       ─┐
      │  ├─ mouth_mbp         │
      │  ├─ mouth_cons        │
      │  ├─ mouth_a           │ exactly one visible at a time
      │  ├─ mouth_i           │ (the controller toggles a class)
      │  ├─ mouth_u           │
      │  ├─ mouth_e           │
      │  ├─ mouth_o           │
      │  ├─ mouth_fv          │
      │  ├─ mouth_l_th       ─┘
      │  ├─ mouth_smile      (optional: happy/idle rest variant)
      │  └─ mouth_wide_smile (optional: celebrating)
      ├─ expr                expression overlay variants (eye shapes, sweat drop, sparkles)
      │  ├─ expr_neutral
      │  ├─ expr_happy       (^ ^ eyes, raised cheeks)
      │  ├─ expr_thinking    (eyes up-left, one brow raised)
      │  ├─ expr_confused    (brows asymmetric, "?" or sweat-drop shape, drawn as paths)
      │  ├─ expr_encouraging
      │  └─ expr_celebrating (star eyes / sparkles)
      └─ hair_front, accessories (static)
```

### 9.3 Pivots and metadata

- Each animated group (`*`) has a `data-pivot="x y"` attribute in viewBox units, for example `<g id="head" data-pivot="256 300">`.
- The controller sets `transform-origin` from it and uses `transform-box: view-box`.
- Artists must not bake rotation into animated groups; their child content may have transforms.

### 9.4 Mouth shapes

- **Geometry:**
  - Draw all ten mouths centred on the same anchor point (the mouth group's pivot).
  - Fit them within a box of about 90×70 viewBox units.
  - Use 3–6 paths each (outline, inner dark, teeth, tongue).
- **Shared style:** line weight and colours are identical across shapes.
- **Reference:** a reference sheet PNG (not shipped) shows each shape next to its phoneme examples (§1.2).
- **Coverage:** every character must implement all 10 IDs, so the controller is shared across characters.

### 9.5 States → required visuals

| State | Mouth | Expression | Idle modifiers |
|---|---|---|---|
| idle | `rest` (or `smile`) | `expr_neutral` | blink, breathe, sway |
| listening | `rest` | `expr_neutral` + slight head tilt | short blinks only, pupils centred |
| thinking | `rest` / `u` small | `expr_thinking` | pupils up-left, slower sway |
| speaking | viseme track | current expression | nods on stress |
| happy / encouraging | `smile` | `expr_happy` / `expr_encouraging` | |
| confused ("didn't catch that") | `o` small | `expr_confused` | head tilt 6°, one long blink |
| celebrating | `wide_smile` / `a` | `expr_celebrating` | rig jump (disabled under reduced motion) |

### 9.6 Export and processing pipeline

1. Author in Figma, Inkscape or Affinity using the exact IDs above. Inkscape needs IDs set in Object Properties, not labels only.
2. Export SVG with "Include id attribute" (Figma) and "outline text". No clip-content on frames.
3. `npm run avatars:build`:
   - normalise IDs (`inkscape:label` → `id` if needed)
   - run SVGO with the §5.3 config
   - run the validator (below)
   - emit `{lang}-{name}.svg` + a `.json` manifest (IDs, pivots, byte size, element count)

### 9.7 Validation checklist (automate in CI)

- [ ] Root has `viewBox="0 0 512 512"` and `data-contract="1"`; no width/height.
- [ ] All required IDs from §9.2 are present; IDs are unique and match `^[a-z][a-z0-9_]*$`.
- [ ] Exactly 10 required `mouth_*` children (+ optional ones), each non-empty.
- [ ] Every `*` group has `data-pivot` with two numbers inside the viewBox.
- [ ] No forbidden elements or attributes (§9.1); `<clipPath>` ≤ 2, gradients ≤ 2.
- [ ] No `display="none"` or `opacity="0"` in the source.
- [ ] Size: ≤ 60 KB minified (cap 120 KB), ≤ 20 KB brotli (cap 40 KB).
- [ ] Elements ≤ 250 (cap 400); paths ≤ 150 (cap 250); path commands ≤ 3,000.
- [ ] Visual regression: a Playwright screenshot per state and per viseme against stored baselines.
- [ ] Runtime smoke test: cycling all visemes at 30 fps on a throttled (4× CPU) profile stays ≤ 4 ms per frame for avatar scripting + style + paint.
- [ ] Contrast: face features remain distinguishable in the dark theme background (if the avatar sits on themed surfaces).

---

## 10. Open questions and tests to run before locking the plan

1. **Azure HD voices:** do `VisemeReceived` events fire for DragonHD / HD Omni voices in ja-JP, de-DE and en-US? (Docs only say `<mstts:viseme>` is unsupported [S4].)
2. **ElevenLabs Japanese:** does `normalized_alignment` return kana when `apply_language_text_normalization=true`? How does kana-only input affect prosody?
3. **Rive pricing conflict:** confirm with Rive whether Free-plan exports with a splash screen are permitted in commercial production, and whether the docs or the pricing page is current [S14][S16].
4. **Device test:** profile the SVG rig and audio analysis on one low-end Android (e.g. 4 GB RAM, Helio G-series) and an older iPhone (iOS 17), with Bluetooth earbuds to test `outputLatency`.
5. **next/font with Noto Sans JP:** confirm all unicode-range slices are emitted and nothing is preloaded.
6. **kuroshiro 2.0 beta:** re-test the accuracy table and the memory footprint once it is stable. Compare against Lindera + UniDic on 200 lesson sentences, with native-speaker review.

---

## Sources

All accessed 2026-10-14. "npm" means registry metadata retrieved with `npm view` (version, licence, publish dates, unpacked size). "Measured" means I downloaded the package tarball or file in a scratch directory and measured `gzip -9` size or ran the code.

- **S1** Microsoft Learn, "Get facial position with viseme" (updated 2026-06-05): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme (VERIFIED)
- **S2** Microsoft Learn, Language support → Visemes table: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts#visemes (VERIFIED)
- **S3** Microsoft Learn, SSML phonetic sets (ja-JP and de-DE viseme tables): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets (VERIFIED)
- **S4** Microsoft Learn, "What are neural text to speech HD voices?" (updated 2026-09-24): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices (VERIFIED)
- **S5** Microsoft Q&A, viseme via REST / containers: https://learn.microsoft.com/en-us/answers/questions/1190743/can-i-get-viseme-data-via-the-text-to-speech-rest ; https://learn.microsoft.com/en-in/answers/questions/1790769/azure-text-to-speech-docker-container-throws-an-ex (REPORTED)
- **S6** Meta, Viseme reference (OVRLipSync): https://developers.meta.com/horizon/documentation/unity/audio-ovrlipsync-viseme-reference/ (VERIFIED)
- **S7** Rhubarb Lip Sync repo, README.adoc, LICENSE.md; GitHub API latest release v1.14.0 (2025-04-03): https://github.com/DanielSWolf/rhubarb-lip-sync (VERIFIED)
- **S8** wawa-lipsync repo and npm 0.0.2 source (`dist/wawa-lipsync.es.js`, `index.d.ts`): https://github.com/wass08/wawa-lipsync (VERIFIED)
- **S9** ElevenLabs API, Create speech with timing: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps (VERIFIED)
- **S10** ElevenLabs API, Stream speech with timing: https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps (VERIFIED)
- **S11** OpenAI, Text to speech guide: https://developers.openai.com/api/docs/guides/text-to-speech (VERIFIED)
- **S12** Google Cloud TTS, SSML reference: https://docs.cloud.google.com/text-to-speech/docs/ssml (VERIFIED)
- **S13** Google Cloud TTS, Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd (VERIFIED)
- **S14** Rive pricing page (HTML inspected: "Export .riv files with a splash screen"; "Free exports play a Rive splash screen. Upgrade to remove it."; Cadet "$9 /seat/mo", 3 seats max; Voyager $32): https://rive.app/pricing (VERIFIED)
- **S15** Rive blog, "Rive's new $9/mo plan" (2025-10-20): https://rive.app/blog/rive-s-new-9-mo-plan (VERIFIED)
- **S16** Rive docs, Exporting for runtime: https://rive.app/docs/editor/exporting/exporting-for-runtime (VERIFIED)
- **S17** Rive docs, Canvas vs WebGL: https://rive.app/docs/runtimes/web/canvas-vs-webgl (VERIFIED)
- **S18** GSAP pricing: https://gsap.com/pricing/ (VERIFIED)
- **S19** GSAP Standard "No Charge" License: https://gsap.com/community/standard-license/ (VERIFIED)
- **S20** Motion docs, Reduce bundle size: https://motion.dev/docs/react-reduce-bundle-size (VERIFIED)
- **S21** Motion, Feature comparison: https://motion.dev/guides/feature-comparison (VERIFIED, vendor-authored)
- **S22** Chrome for Developers, "Updates in hardware-accelerated animation capabilities" (last updated 2021-02-22): https://developer.chrome.com/blog/hardware-accelerated-animations (VERIFIED)
- **S23** PixiJS v8 guide, SVGs: https://pixijs.com/8.x/guides/components/assets/svg (VERIFIED)
- **S24** dotLottie Web repo: https://github.com/LottieFiles/dotlottie-web (VERIFIED)
- **S25** LottieFiles pricing: https://lottiefiles.com/pricing (VERIFIED; free tier not detailed on page)
- **S26** LottieFiles help "Is Lottie Creator free?" (now 404) and LottieFiles blog via search summary: https://help.lottiefiles.com/hc/en-us/articles/15418024472345-Is-Lottie-Creator-free ; https://lottiefiles.com/blog/design-guides-and-tips/best-motion-design-tools-ranked-by-use-case (REPORTED)
- **S27** Glaxnimate: https://glaxnimate.org/ (VERIFIED)
- **S28** Esoteric Software, Spine purchase: https://en.esotericsoftware.com/spine-purchase (VERIFIED; prices shown as discounted)
- **S29** Live2D, SDK release license: https://www.live2d.com/en/sdk/license/ (VERIFIED)
- **S30** Live2D, Expandable Application: https://www.live2d.com/en/sdk/license/expandable/ (VERIFIED)
- **S31** Live2D, Cubism FREE vs PRO comparison: https://www.live2d.com/en/cubism/comparison/ (VERIFIED)
- **S32** VRoid Studio page (HTML inspected): https://vroid.com/en/studio (VERIFIED)
- **S33** three-vrm repo: https://github.com/pixiv/three-vrm (VERIFIED)
- **S34** VRM 1.0 expressions: https://vrm.dev/en/vrm1/expression/ (VERIFIED)
- **S35** Figma Help, Export formats and settings: https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings (VERIFIED)
- **S36** Figma pricing: https://www.figma.com/pricing/ (VERIFIED; SVG export on Starter not explicitly stated)
- **S37** Affinity (Canva): https://www.affinity.studio/ (VERIFIED)
- **S38** svgsplitter notes on Affinity layer-name IDs: https://crystaldoc.info/github/Billiam/svgsplitter ; Realmac forum thread: https://forums.realmacsoftware.com/t/svg-image-created-using-affinity-designer-or-affinity-photo/20449/9 (REPORTED)
- **S39** Inkscape: bug "SVG IDs don't match layer names" https://bugs.qastaging.launchpad.net/inkscape/+bug/243383 ; inbox issue 265 https://gitlab.com/inkscape/inbox/issues/265 (REPORTED)
- **S40** Krita: KDE GSoC 2022 status https://community.kde.org/GSoC/2022/StatusReports/ReinoldRojas ; https://krita-artists.org/t/svg-export-issue/43071 ; https://krita-artists.org/t/krita-addon-svg-merge-save/114787 (REPORTED)
- **S41** SVGO preset-default: https://svgo.dev/docs/preset-default/ (VERIFIED)
- **S42** SVGO cleanupIds: https://svgo.dev/docs/plugins/cleanupIds/ (VERIFIED)
- **S43** SVGO removeHiddenElems: https://svgo.dev/docs/plugins/removeHiddenElems/ (VERIFIED)
- **S44** SVGO collapseGroups: https://svgo.dev/docs/plugins/collapseGroups/ (VERIFIED)
- **S45** kuroshiro repo and README (v2 notes, modes, romaji systems, furigana output): https://github.com/hexenq/kuroshiro ; https://raw.githubusercontent.com/hexenq/kuroshiro/master/README.md (VERIFIED; behaviour tested in scratch run)
- **S46** kuromoji.js: https://github.com/takuyaa/kuromoji.js ; npm kuromoji 0.1.2 (2018), dict measured 17 MB .dat.gz (VERIFIED/measured)
- **S47** lindera-wasm (archived 2026-03-28) and lindera monorepo v6.2.0: https://github.com/lindera/lindera-wasm ; https://github.com/lindera/lindera (VERIFIED)
- **S48** sudachi.rs (v0.7.0, 2026-09-24): https://github.com/WorksApplications/sudachi.rs (VERIFIED)
- **S49** WanaKana: https://github.com/WaniKani/WanaKana (VERIFIED; behaviour tested)
- **S50** MDN `<ruby>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ruby (VERIFIED)
- **S51** MDN browser-compat-data 8.1.5 (npm `@mdn/browser-compat-data`): ruby, rt, ruby-position, ruby-align, AudioContext.outputLatency/baseLatency, prefers-reduced-motion (VERIFIED)
- **S52** Next.js docs, Font module (updated 2026-09-24): https://nextjs.org/docs/app/api-reference/components/font (VERIFIED)
- **S53** Google Fonts CSS2 API, Noto Sans JP 400/700 (slices counted and sampled): https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700 (VERIFIED/measured)
- **S54** Lighthouse throttling docs: https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md (VERIFIED)
- **S55** web.dev, Web Vitals: https://web.dev/articles/vitals (VERIFIED)
- **S56** Hömke, Holler & Levinson (2018), "Eye blinks are perceived as communicative signals in human face-to-face interaction", PLOS ONE: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0208030 (VERIFIED)
- **S57** Blink rate in conversation: medRxiv 2022 https://medrxiv.org/content/10.1101/2022.11.19.22282503.full.pdf ; PubMed 14586592 https://pubmed.ncbi.nlm.nih.gov/14586592/ (REPORTED, via search summary)
- **S58** WebKit Bugzilla on MediaElementSource/Analyser issues: https://bugs.webkit.org/show_bug.cgi?id=125031 ; https://bugs.webkit.org/show_bug.cgi?id=180696 ; https://bugs.webkit.org/show_bug.cgi?id=211394 ; https://bugs.webkit.org/show_bug.cgi?id=204467 (REPORTED)
- **S59** npm registry metadata (`npm view`): @rive-app/canvas(-lite)/webgl2 2.44.2 MIT; lottie-web 5.13.0 MIT; @lottiefiles/dotlottie-web 0.81.0 MIT; gsap 3.15.0 (Standard no-charge licence); motion 14.2.0 MIT; pixi.js 8.22.0 MIT; wawa-lipsync 0.0.2 MIT; meyda 5.6.3 MIT; kuroshiro 1.2.1 / 2.0.0-beta.2 MIT; kuroshiro-analyzer-kuromoji 1.1.0 / 2.0.0-beta.2 MIT; kuromoji 0.1.2 Apache-2.0; wanakana 5.3.1 MIT; lindera-wasm 6.2.0 MIT; lindera-wasm-nodejs-ipadic/-unidic 2.0.0 MIT; mecab-wasm 1.0.3; sudachi 0.1.5; @pixiv/three-vrm 3.5.5 MIT; three 0.186.1 MIT; @esotericsoftware/spine-pixi-v8 4.3.13 (LicenseRef); svgo 4.1.0 MIT; microsoft-cognitiveservices-speech-sdk 1.52.0 MIT; cmu-pronouncing-dictionary 3.0.0 ISC (VERIFIED)
- **S60** CMUdict LICENSE (BSD-style): https://github.com/cmusphinx/cmudict ; eSpeak NG (GPL-3.0): https://github.com/espeak-ng/espeak-ng ; phonemizer.js (Apache-2.0, wraps eSpeak NG): https://github.com/xenova/phonemizer.js (VERIFIED)
- **S61** Meyda: https://github.com/meyda/meyda (VERIFIED: MIT, last release v5.6.3, 2024-04-21)
- **S62** ITU-R BT.1359 (PDF) and summaries: https://itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf ; https://en.wikipedia.org/wiki/Audio-to-video_synchronization (REPORTED: thresholds taken from secondary summaries, PDF not read)

**Measurements made for this note** (scratch directory, 2026-10-14, `gzip -9`):
- Rive wasm: `canvas-lite` 314 KB gz, `canvas` 849 KB gz
- dotlottie-web wasm: 496 KB gz
- `lottie_light.min.js` 46 KB gz
- `gsap.min.js` 28 KB gz
- `pixi.min.js` 237 KB gz
- three (esbuild-minified bundle) ~185 KB gz
- three-vrm 37 KB gz
- WanaKana 6.9 KB gz
- kuromoji IPADIC dict 17 MB (.dat.gz)
- Noto Sans JP: 124 slices per weight, 8–90 KB each
- kuroshiro accuracy and memory run (§6.1)
