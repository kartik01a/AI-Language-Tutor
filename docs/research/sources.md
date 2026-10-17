# Research Sources

> All sources were accessed on **2026-10-14** by the research pass for this plan. Each section below is copied verbatim from the Sources list of the corresponding research note, so citation IDs (e.g. `[S12]`) match the IDs used inside that note. Evidence labels (VERIFIED / REPORTED / ESTIMATE) are explained at the top of each note.
>
> Back to [docs README](../README.md) · [Provider comparison](provider-comparison.md)

| Note | Topic | Used by |
|---|---|---|
| [notes/stt-and-llm.md](notes/stt-and-llm.md) | Speech-to-text, LLMs, speech-to-speech, STT/LLM cost | [04](../04-ai-provider-research.md), [06](../06-ai-tutor-behavior.md), [12](../12-cost-and-performance-model.md) |
| [notes/tts-and-voice.md](notes/tts-and-voice.md) | TTS providers, voice consistency, Japanese readings, TTS cost | [04](../04-ai-provider-research.md), [05](../05-voice-and-speech-architecture.md), [12](../12-cost-and-performance-model.md) |
| [notes/avatar-lipsync-japanese-text.md](notes/avatar-lipsync-japanese-text.md) | Avatar tech, visemes, lip-sync, furigana/romaji, fonts | [03](../03-design-system-and-avatar-spec.md), [05](../05-voice-and-speech-architecture.md) |
| [notes/infra-browser-privacy.md](notes/infra-browser-privacy.md) | Hosting, Supabase, browser audio, DPDP, infra cost | [09](../09-system-architecture.md), [14](../14-security-and-privacy.md), [15](../15-deployment-and-operations.md), [12](../12-cost-and-performance-model.md) |
| [notes/pedagogy-and-reliability.md](notes/pedagogy-and-reliability.md) | Corrective feedback, scaffolding, CEFR, GEC/ASR reliability, dialogue recovery, level estimation | [06](../06-ai-tutor-behavior.md), [07](../07-conversation-state-machine.md), [08](../08-language-learning-engine.md) |


---

## Sources — notes/stt-and-llm.md


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

---

## Sources — notes/tts-and-voice.md


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

---

## Sources — notes/avatar-lipsync-japanese-text.md


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

---

## Sources — notes/infra-browser-privacy.md


All accessed 2026-10-14.

- [S1] Cloud Run pricing: https://cloud.google.com/run/pricing
- [S2] Google Cloud Free Program / Free Tier features: https://docs.cloud.google.com/free/docs/free-cloud-features
- [S3] VPC network pricing (internet egress, Premium Tier): https://cloud.google.com/vpc/network-pricing
- [S4] Cloud Run request timeout: https://docs.cloud.google.com/run/docs/configuring/request-timeout
- [S5] Cloud Run quotas and limits: https://docs.cloud.google.com/run/quotas
- [S6] Cloud Run "Invoke with an HTTPS request" (streaming), via search summary: https://docs.cloud.google.com/run/docs/triggering/https-request ; launch blog: https://cloud.google.com/blog/products/serverless/cloud-run-now-supports-http-grpc-server-streaming
- [S7] Cloud Run WebSockets: https://docs.cloud.google.com/run/docs/triggering/websockets
- [S8] Cloud Run CPU limits / startup CPU boost: https://docs.cloud.google.com/run/docs/configuring/services/cpu
- [S9] Cloud Run max instances: https://docs.cloud.google.com/run/docs/configuring/max-instances
- [S10] Spend cap budgets: https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps ; GA status via search of https://docs.cloud.google.com/billing/docs/release-notes
- [S11] Budgets and alerts: https://docs.cloud.google.com/billing/docs/how-to/budgets
- [S12] OneUptime blog (cold start estimate, Feb 2026): https://oneuptime.com/blog/post/2026-02-17-how-to-configure-minimum-instances-on-cloud-run-to-eliminate-cold-starts-for-production-services/markdown
- [S13] Cloud Run min instances: https://docs.cloud.google.com/run/docs/configuring/min-instances
- [S14] Cloud Run Next.js quickstart (via search summary): https://cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service
- [S15] Next.js self-hosting guide (lastUpdated 2026-10-01): https://nextjs.org/docs/app/guides/self-hosting
- [S16] npm registry metadata: https://registry.npmjs.org/@opennextjs/cloudflare , https://registry.npmjs.org/vinext , https://registry.npmjs.org/next , https://registry.npmjs.org/@supabase/ssr
- [S17] Artifact Registry pricing: https://cloud.google.com/artifact-registry/pricing
- [S18] Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- [S19] Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- [S20] OpenNext Cloudflare overview: https://opennext.js.org/cloudflare
- [S21] Cloudflare Website & Online Services Terms: https://www.cloudflare.com/website-terms/
- [S22] Cloudflare Service-Specific Terms, Developer Platform: https://www.cloudflare.com/service-specific-terms-developer-platform/
- [S23] OpenNext Cloudflare get started: https://opennext.js.org/cloudflare/get-started
- [S24] OpenNext Cloudflare known issues: https://opennext.js.org/cloudflare/known-issues
- [S25] Cloudflare Workers Next.js framework guide (vinext): https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- [S26] Search results: Workers error 1102 / OpenNext startup CPU (dev.to feed, Aug 2026): https://dev.to/feed/ricogr
- [S27] Vercel Fair Use Guidelines (last_updated 2026-09-14): https://vercel.com/docs/limits/fair-use-guidelines
- [S28] Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- [S29] Render free instances: https://render.com/docs/free
- [S30] Railway plans: https://docs.railway.com/reference/pricing/plans
- [S31] Fly.io pricing: https://docs.fly.io/about/pricing
- [S32] Netlify pricing: https://www.netlify.com/pricing/
- [S33] Supabase pricing: https://supabase.com/pricing
- [S34] Supabase egress usage: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- [S35] Supabase Edge Function limits: https://supabase.com/docs/guides/functions/limits
- [S36] Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- [S37] Supabase backups: https://supabase.com/docs/guides/platform/backups
- [S38] Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- [S39] Supabase regions: https://supabase.com/docs/guides/platform/regions
- [S40] Supabase Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- [S41] Sentry pricing: https://sentry.io/pricing/
- [S42] PostHog pricing: https://posthog.com/pricing
- [S43] PostHog product analytics pricing: https://posthog.com/docs/product-analytics/pricing
- [S44] GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [S45] Upstash Redis pricing: https://upstash.com/pricing/redis
- [S46] MDN browser-compat-data v8.1.5 (timestamp 2026-10-08), via https://unpkg.com/@mdn/browser-compat-data/data.json (keys: MediaRecorder, applyConstraints.*_constraint, getSupportedConstraints, MediaSource, ManagedMediaSource, AudioSession, Navigator.getAutoplayPolicy, AudioContext, decodeAudioData, AudioWorklet, HTMLMediaElement.preservesPitch, Response.body)
- [S47] WebKit blog, Safari 18.4 features: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- [S48] addpipe MediaRecorder API demo (codec table): https://addpipe.com/media-recorder-api-demo/ ; MDN MediaRecorder.mimeType: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType
- [S49] OpenAI speech-to-text guide: https://developers.openai.com/api/docs/guides/speech-to-text
- [S50] WebKit bugs 215884 / 212040: https://bugs.webkit.org/show_bug.cgi?id=215884 , https://bugs.webkit.org/show_bug.cgi?id=212040
- [S51] MDN Autoplay guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- [S52] Chrome autoplay policy: https://developer.chrome.com/blog/autoplay
- [S53] MDN Navigator.audioSession: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/audioSession
- [S54] WebKit bug 251532 (Web Audio muted by silent switch; audioSession.type workaround): https://bugs.webkit.org/show_bug.cgi?id=251532 ; W3C Audio Session: https://www.w3.org/TR/audio-session/
- [S55] WebKit blog, Safari 17.1 (ManagedMediaSource on iPhone): https://webkit.org/blog/14735/webkit-features-in-safari-17-1/
- [S56] OpenAI text-to-speech guide: https://developers.openai.com/api/docs/guides/text-to-speech
- [S57] ElevenLabs TTS stream API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- [S58] MDN HTMLMediaElement.preservesPitch: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch ; caniuse: https://caniuse.com/mdn-api_htmlmediaelement_preservespitch
- [S59] ricky0123/vad GitHub: https://github.com/ricky0123/vad ; npm: https://registry.npmjs.org/@ricky0123/vad-web ; file sizes: https://unpkg.com/@ricky0123/vad-web@0.0.31/dist/?meta
- [S60] onnxruntime-web 1.22.0 WASM (size measured): https://unpkg.com/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm ; Silero VAD license (MIT) via https://api.github.com/repos/snakers4/silero-vad/license
- [S61] HN thread (iOS Safari OOM with in-browser Silero + ASR): https://brianlovin.com/hn/47995037
- [S62] **DPDP Rules, 2025, G.S.R. 846(E), Gazette of India, 13 Nov 2025 (English pp. 24–41)**: https://egazette.gov.in/WriteReadData/2025/267650.pdf
- [S63] Shardul Amarchand Mangaldas, "Enforcement of the DPDP Act and notification of the DPDP Rules": https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/
- [S64] Search summaries of law-firm trackers on commencement (G.S.R. 843(E)) and interim regime: https://dpdpa.dcomply.in/rules/ , https://www.privybyidfy.com/blog/dpdp-compliance-guide-2026-what-indian-enterprises-must-do-before-may-2027
- [S65] dpdprules.org, "DPDP deadline: is the 18 month window being cut to 12 months?" (published 2026-09-01, reviewed 2026-10-12): https://dpdprules.org/blog/dpdp-18-months-to-12-months-proposal
- [S66] Foxmandal note on DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E) (via search summary): https://foxmandal.in/?p=60705
- [S67] **Digital Personal Data Protection Act, 2023 (No. 22 of 2023), Gazette text** (TRAI-hosted copy): https://www.trai.gov.in/sites/default/files/2024-09/DPDT_11082024.pdf ; India Code: https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf
- [S68] SS Rana & Co. (Bar & Bench), "MeitY notifies final DPDP Rules, 2025" (17 Nov 2025): https://www.barandbench.com/amp/story/law-firms/view-point/meity-notifies-final-digital-personal-data-protection-rules-2025 ; NALSAR Tech Law Forum on Rule 8(3): https://techlawforum.nalsar.ac.in/?p=2770
- [S69] CERT-In Directions 2022 summaries: Khaitan & Co: https://khaitanco.com/thought-leaderships/Indian-Computer-Emergency-Response-Team-Direction-Paradigm-Shift-in-Cyber-Incident-Reporting ; Linklaters: https://www.linklaters.com/en/insights/blogs/digilinks/2022/may/india-new-and-onerous-cyber-security-framework-and-breach-reporting-obligations
- [S70] Mansukhlal Hiralal & Co. (Legal 500), "Children's Data Protection Under India's DPDP Act": https://www.legal500.com/intelligence/india/privacy/childrens-data-protection-under-indias-dpdp-act-what-businesses-need-to-know
- [S71] Commentary on age assurance (draft and final Rules): Takshashila: https://takshashila.org.in/content/blogs/20251114-meity-notifies-dpdp-rules-2025.html ; MediaNama: https://www.medianama.com/2025/01/223-draft-dpdp-rules-2025-leave-doubts-age-verification-data-localisation/ ; AM Legals: https://amlegals.com/whatsapps-age-check-and-the-dpdp-act-what-section-9-means-for-childrens-data-compliance/
- [S72] IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (PRS copy): https://PRSINDIA.org/files/bills_acts/bills_parliament/2011/IT_Rules_2011.pdf
- [S73] Microsoft Learn, Azure Speech to text data, privacy and security: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security
- [S74] OpenAI "Data controls in the OpenAI platform": https://developers.openai.com/api/docs/guides/your-data
- [S75] ElevenLabs privacy policy: https://elevenlabs.io/privacy-policy
- [S76] ElevenLabs Zero Retention Mode: https://elevenlabs.io/docs/developers/resources/zero-retention-mode

#### Not verified in this pass (open items)
- The asia-south1-specific Premium Tier egress rate (the page rendered only the us-central1 view).
- Whether the Cloud Run free tier offsets min-instance idle charges.
- Commercial-use terms for Supabase Free, Railway, Netlify Free and the Cloudflare Self-Serve Subscription Agreement.
- Fly.io Mumbai region.
- Sentry and PostHog data-residency options and DPAs.
- Codec support inside ManagedMediaSource on iOS.
- iOS output routing and volume while the mic stream is open.
- Current status of WebKit bug 215884 on iOS 26/27.
- Price of the Supabase custom-domain add-on.
- Whether ElevenLabs' training opt-out covers API traffic.
- Bitrates of OpenAI's mp3/opus TTS output.

---

## Sources — notes/pedagogy-and-reliability.md


All accessed 2026-10-14. The label shows how each was used in these notes.

#### Corrective feedback and SLA

- Aljaafreh, A., & Lantolf, J. P. (1994). Negative feedback as regulation and second language learning in the zone of proximal development. *The Modern Language Journal, 78*(4), 465–483. https://doi.org/10.1111/j.1540-4781.1994.tb02064.x (PDF read: https://files.cercomp.ufg.br/weby/up/1752/o/Negative_Feedback_as_Regulation_and_Seco.pdf). **VERIFIED**
- Bao, R., & Wang, H. (2023). A comparison between the preferences for oral corrective feedback of teachers and students of Chinese as a second language. *Frontiers in Psychology, 14*. https://doi.org/10.3389/fpsyg.2023.1112136. **VERIFIED**
- Brock, C. A. (1986). The effects of referential questions on ESL classroom discourse. *TESOL Quarterly, 20*(1), 47–59. https://doi.org/10.2307/3586388. **REPORTED**
- Ellis, R., Loewen, S., & Erlam, R. (2006). Implicit and explicit corrective feedback and the acquisition of L2 grammar. *Studies in Second Language Acquisition, 28*(2), 339–368. https://www.cambridge.org/core/product/CDE67D4A4E286921DA4BE9C40BAD9FE6. **REPORTED**
- Fu, M., & Li, S. (2022). The effects of immediate and delayed corrective feedback on L2 development. *SSLA, 44*(1), 2–34. https://doi.org/10.1017/S0272263120000388. **REPORTED (citation only)**
- Krashen, S. (1985). *The Input Hypothesis: Issues and Implications.* Longman. **REPORTED (standard citation)**
- Li, S. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. *Language Learning, 60*(2), 309–365. https://researchspace.auckland.ac.nz/handle/2292/24985. **REPORTED**
- Li, S., Zhu, Y., & Ellis, R. (2016). The effects of the timing of corrective feedback on the acquisition of a new linguistic structure. *The Modern Language Journal, 100*, 276–295. https://research.polyu.edu.hk/en/publications/the-effects-of-the-timing-of-corrective-feedback-on-the-acquisiti/. **REPORTED**
- Long, M. H. (1996). The role of the linguistic environment in second language acquisition. In W. C. Ritchie & T. K. Bhatia (Eds.), *Handbook of Second Language Acquisition*. Academic Press. **REPORTED (standard citation)**
- Lyster, R., & Ranta, L. (1997). Corrective feedback and learner uptake. *SSLA, 19*, 37–66. Figures taken from Tedick, D. J., & de Gortari, B. (1998). Research on error correction and implications for classroom teaching. *ACIE Newsletter, 1*(3), CARLA, University of Minnesota. https://archive.carla.umn.edu/immersion/acie/vol1/May1998.pdf. **REPORTED (detailed secondary; read)**
- Lyster, R., & Saito, K. (2010). Oral feedback in classroom SLA: A meta-analysis. *SSLA, 32*(2), 265–302. https://doi.org/10.1017/S0272263109990520. **VERIFIED (abstract)**
- Lyster, R., Saito, K., & Sato, M. (2013). Oral corrective feedback in second language classrooms. *Language Teaching, 46*(1), 1–40. https://www.cambridge.org/core/journals/language-teaching/article/abs/oral-corrective-feedback-in-second-language-classrooms/B33FC71C12A1317DCA0CE704B7B0BC00. **REPORTED (abstract)**
- Mackey, A., & Goo, J. (2007). Interaction research in SLA: A meta-analysis and research synthesis. In A. Mackey (Ed.), *Conversational Interaction in Second Language Acquisition*. OUP. **REPORTED (figures via Lyster & Saito 2010)**
- Poehner, M. E., & Lantolf, J. P. Computerized dynamic assessment, as summarised by CALPER (Penn State): https://sites.psu.edu/calperlanguageassessment/assessment-approaches/dynamic-assessment. **REPORTED**
- Rowe, M. B. (1986). Wait time: Slowing down may be a way of speeding up! *Journal of Teacher Education, 37*(1), 43–50. https://doi.org/10.1177/002248718603700110. **REPORTED**
- Russell, J., & Spada, N. (2006). The effectiveness of corrective feedback for the acquisition of L2 grammar: A meta-analysis. In J. Norris & L. Ortega (Eds.), *Synthesizing Research on Language Learning and Teaching*. John Benjamins. **REPORTED**
- Sheen, Y. (2006). Exploring the relationship between characteristics of recasts and learner uptake. *Language Teaching Research, 10*(4), 361–392. https://doi.org/10.1191/1362168806lr203oa. **REPORTED**
- Stivers, T., et al. (2009). Universals and cultural variation in turn-taking in conversation. *PNAS, 106*(26), 10587–10592. https://doi.org/10.1073/pnas.0903616106. **REPORTED (abstract)**
- Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output in its development. In S. Gass & C. Madden (Eds.), *Input in Second Language Acquisition*. Newbury House. Also Swain (1995), Three functions of output. **REPORTED (standard citations)**

#### Levels, frameworks and assessment

- Council of Europe / Europass. *Common European Framework of Reference for Languages: Self-assessment grid* (© European Union and Council of Europe, 2004–2020). https://europass.europa.eu/system/files/2020-05/CEFR%20self-assessment%20grid%20EN.pdf. **VERIFIED**
- Council of Europe. (2020). *CEFR Companion Volume.* https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4. **Not accessible (403); not quoted**
- Council of Europe. Copyright, licensing and permissions. https://www.coe.int/en/web/portal/copyright-licensing-permissions. **REPORTED (via search)**
- Japan Foundation & JEES. CEFR reference levels for the JLPT. https://www.jlpt.jp/e/about/cefr_reference.html. **VERIFIED**
- Japan Foundation. What is the JF Standard for Japanese-Language Education? https://www.kyozai.jpf.go.jp/kyozai/help/about/jfscando/en/render.do. **VERIFIED**
- Goethe-Institut exam information pages, e.g., https://www.goethe.de/ins/hon/en/spr/exams/a1f/wei.html. **REPORTED**
- Li, M., & Zhang, X. (2021). A meta-analysis of self-assessment and language performance in language testing and assessment. *Language Testing, 38*(2), 189–218. https://sage.figshare.com/collections/A_meta-analysis_of_self-assessment_and_language_performance_in_language_testing_and_assessment/5021492. **REPORTED**
- Milton, J., & Alexiou, T. (2010). Developing a vocabulary size test in Greek as a foreign language. *GALA Selected Papers*, 307–318 (Table 2 reproduces Milton & Alexiou 2009, Palgrave). https://www.enl.auth.gr/gala/14th/Papers/English%20papers/Milton&Alexiou.pdf. **VERIFIED**
- Ross, S. (1998). Self-assessment in second language testing: A meta-analysis and analysis of experiential factors. *Language Testing, 15*(1). **REPORTED (figures via secondary)**
- Yancey, K. P., LaFlair, G. T., Verardi, A. R., & Burstein, J. (2023). Rating short L2 essays on the CEFR scale with GPT-4. *BEA 2023*, 576–584. https://doi.org/10.18653/v1/2023.bea-1.49. **VERIFIED (abstract)**
- Bannò, S., Vydana, H. K., Knill, K. M., & Gales, M. J. F. (2024). Can GPT-4 do L2 analytic assessment? *BEA 2024*, 149–164. https://aclanthology.org/2024.bea-1.14. **REPORTED**
- Bannò, S., et al. (2025). Natural language-based assessment of L2 oral proficiency using LLMs. arXiv:2507.10200. **REPORTED**
- Ma, R., et al. (2025). Assessment of L2 oral proficiency using speech large language models. *Interspeech 2025*. https://www.isca-archive.org/interspeech_2025/ma25b_interspeech.html. **REPORTED**
- Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education*. https://doi.org/10.1016/j.compedu.2016.03.017. **REPORTED (abstract)**
- McCarthy, P. M., & Jarvis, S. (2010). MTLD, vocd-D, and HD-D. *Behavior Research Methods, 42*(2), 381–392. https://doi.org/10.3758/BRM.42.2.381. **REPORTED (abstract)**
- Kormos, J., & Dénes, M. (2004). Exploring measures and perceptions of fluency in the speech of second language learners. *System, 32*(2), 145–164. https://doi.org/10.1016/j.system.2004.01.001. **REPORTED**
- LLM-judge variance preprints: arXiv:2503.09347; arXiv:2603.04417; arXiv:2606.26185. **REPORTED (preprints)**

#### GEC, ASR and dialogue reliability

- Coyne, S., Sakaguchi, K., Galvan-Sosa, D., Zock, M., & Inui, K. (2023). Analyzing the performance of GPT-3.5 and GPT-4 in grammatical error correction. arXiv:2303.14342. https://arxiv.org/abs/2303.14342. **VERIFIED (abstract)**
- Fang, T., et al. (2023). Is ChatGPT a highly fluent grammatical error correction system? A comprehensive evaluation. arXiv:2304.01746. **REPORTED**
- Loem, M., Kaneko, M., Takase, S., & Okazaki, N. (2023). Exploring effectiveness of GPT-3 in grammatical error correction. *BEA 2023*, 205–219. https://aclanthology.org/2023.bea-1.18. **REPORTED**
- Davis, C., et al. (2024). Prompting open-source and commercial language models for grammatical error correction of English learner text. *Findings of ACL 2024*. https://arxiv.org/abs/2401.07702. **VERIFIED (abstract)**
- Goto, T., Sakai, Y., & Watanabe, T. (2026). Edit-level majority voting mitigates over-correction in LLM-based grammatical error correction. *BEA 2026*. https://arxiv.org/abs/2605.13624. **VERIFIED (abstract)**
- Karpo, K., & Chernodub, A. (2026). Larger context window, fewer overcorrections. *Findings of EMNLP 2026*. https://arxiv.org/abs/2609.10810. **VERIFIED (abstract)**
- Song, Y., Krishna, K., Bhatt, R., Gimpel, K., & Iyyer, M. (2024). GEE! Grammar error explanation with large language models. *Findings of NAACL 2024*. https://arxiv.org/abs/2311.09517. **VERIFIED (abstract)**
- Encode Errors: Representational retrieval of in-context demonstrations for multilingual GEC. arXiv:2606.15416. **REPORTED**
- Koyama, A., et al. (2020). Construction of an evaluation corpus for grammatical error correction for learners of Japanese as a second language. *LREC 2020*. https://aclanthology.org/2020.lrec-1.26. **REPORTED**
- Wang & Yuan (2024). Assessing the efficacy of grammar error correction: A human evaluation approach in the Japanese context. arXiv:2402.18101. **REPORTED**
- Bryant, C., Felice, M., & Briscoe, T. (2017). Automatic annotation and evaluation of error types for grammatical error correction (ERRANT). *ACL 2017*. **REPORTED (standard citation)**
- Qian, M., Ma, R., Bannò, S., Gales, M. J. F., & Knill, K. M. (2025). End-to-end spoken grammatical error correction. arXiv:2506.18532. **VERIFIED (abstract)**
- Qian, M., Knill, K., Bannò, S., et al. (2024). Speak & Improve Challenge 2025: Tasks and baseline systems. arXiv:2412.11985. Also Knill, K., et al. (2024). Speak & Improve Corpus 2025. arXiv:2412.11986. **REPORTED**
- Kumar, C. V. T., Sirigiraju, M., Vaideeswaran, R., Ghosh, P. K., & Yarra, C. (2023). Can the decoded text from automatic speech recognition effectively detect spoken grammar errors? *SLaTE 2023*. https://www.isca-archive.org/slate_2023/venkatathirumalakumar23_slate.html. **VERIFIED (abstract)**
- Kim, H., et al. (2024). LearnerVoice: A dataset of non-native English learners' spontaneous speech. *Interspeech 2024*. https://doi.org/10.21437/Interspeech.2024-2392. **VERIFIED (abstract)**
- Graham, C., & Roll, N. (2024). Evaluating OpenAI's Whisper ASR: Performance analysis across diverse accents and speaker traits. *JASA Express Letters*. https://doi.org/10.1121/10.0024876. **VERIFIED (abstract)**
- Javed, T., et al. (2023). Svarah: Evaluating English ASR systems on Indian accents. *Interspeech 2023*. https://arxiv.org/abs/2305.15760. **REPORTED**
- Bohus, D., & Rudnicky, A. I. (2005). Sorry, I didn't catch that! An investigation of non-understanding errors and recovery strategies. *6th SIGdial Workshop*, 128–143. https://aclanthology.org/2005.sigdial-1.14. **VERIFIED (full text)**
- Madge, Purver, & Poesio (2025). Referential ambiguity and clarification requests: Comparing human and LLM behaviour. *CRAC 2025*. https://aclanthology.org/2025.crac-1.1.pdf. **REPORTED**
- Xiong, M., et al. (2024). Can LLMs express their uncertainty? An empirical evaluation of confidence elicitation in LLMs. *ICLR 2024*. https://arxiv.org/abs/2306.13063. **REPORTED (abstract)**
- Huang, J., et al. (2024). Large language models cannot self-correct reasoning yet. *ICLR 2024*. https://arxiv.org/abs/2310.01798. **REPORTED (abstract)**

#### Error patterns, varieties and pragmatics

- Sharma, D. (2005). Language transfer and discourse universals in Indian English article use. *SSLA, 27*(4), 535–566. https://doi.org/10.1017/S0272263105050242. **REPORTED (abstract)**
- eWAVE: Electronic World Atlas of Varieties of English, Indian English datapoints (e.g., progressive with stative verbs). https://ewave-atlas.org/. **REPORTED (via search snippet)**
- San José State University WAC. Guide: Indian-English variations. https://gcp-web.sjsu.edu/wac/docs/Guide%20Indian-English%20Variations.pdf. **REPORTED**
- Fleisig, E., et al. (2024). Linguistic bias in ChatGPT: Language models reinforce dialect discrimination. *EMNLP 2024*, 13541–13564. https://arxiv.org/abs/2406.08818. **VERIFIED (abstract)**
- Clahsen, H., Meisel, J., & Pienemann, M. (1983). *Deutsch als Zweitsprache.* Narr. Also Pienemann, M. (1998). *Language Processing and Second Language Development.* Benjamins. Stage summaries from https://msuweb.montclair.edu/~sotillos/stages-sequences.htm. **REPORTED**
- Diehl, E., et al. (2000). *Grammatikunterricht: Alles für der Katz?* Niemeyer (DiGS project). https://www.unige.ch/lettres/alman/de/recherche/abgeschlossene-projekte/digs. **REPORTED**
- L2 grammatical gender in a complex morphological system: The case of German. *IRAL* (2008). https://www.degruyterbrill.com/document/doi/10.1515/IRAL.2008.014/html. **REPORTED**
- Japanese style-shift research: Taguchi (2019) and Cook (masu as indexical), via https://emcawiki.net/Taguchi-Yoshimi2019. **REPORTED**
- JSL particle-error studies: NAIST thesis https://naist.repo.nii.ac.jp/record/10797/files/R012380.pdf; APU *Polyglossia* 18 (Oyama) https://secure.en.apu.ac.jp/rcaps/uploads/fckeditor/publications/polyglossia/Polyglossia_V18_Oyama.pdf. **REPORTED**
- Clyne, M., Norrby, C., & Warren, J. (2009). *Language and Human Relations: Styles of Address in Contemporary Language.* Cambridge University Press. **REPORTED**

#### Spaced repetition

- Anki Manual FAQ: What spaced repetition algorithm does Anki use? https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm.md. **VERIFIED**
- open-spaced-repetition/srs-benchmark. https://github.com/open-spaced-repetition/srs-benchmark. **VERIFIED (README)**
- open-spaced-repetition/ts-fsrs (MIT). https://github.com/open-spaced-repetition/ts-fsrs. **VERIFIED**
- Anki forum discussion citing FSRS-5 vs SM-2 (97.4%). https://forums.ankiweb.net/t/has-anyone-done-a-live-comparison-of-fsrs-and-sm2-as-implemented-in-anki-it-looks-like-no-so-can-anyone-help-me-set-it-up/34996. **REPORTED**
