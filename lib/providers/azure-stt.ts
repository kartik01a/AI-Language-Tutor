import type { SttProvider, SttResult } from "./types";

// Azure short-audio REST STT (WAV only). The detailed format returns ONE confidence per utterance,
// not per word, so the result is a single "word": enough to compare gates in a bake-off, but a real
// integration would use the Speech SDK's word-level output to get ASR-risk spans.

export interface AzureSttOptions {
  key: string;
  region: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface AzureSttResponse {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: { Confidence?: number; Display?: string; Lexical?: string }[];
}

export function parseAzureStt(j: AzureSttResponse, locale: string): SttResult {
  if (j.RecognitionStatus !== "Success") return { text: "", words: [], lang: locale, langConf: null };
  const best = j.NBest?.[0];
  const text = (best?.Display ?? j.DisplayText ?? "").trim();
  if (!text) return { text: "", words: [], lang: locale, langConf: null };
  return { text, words: [{ w: text, conf: typeof best?.Confidence === "number" ? best.Confidence : null }], lang: locale, langConf: null };
}

export class AzureStt implements SttProvider {
  constructor(private o: AzureSttOptions) {}

  async transcribe(audio: Uint8Array, mime: string, langs: string[]): Promise<SttResult> {
    if (!mime.includes("wav")) throw new Error("Azure REST STT needs WAV audio");
    const locale = ({ ja: "ja-JP", de: "de-DE", en: "en-IN", hi: "hi-IN" } as Record<string, string>)[langs[0]] ?? langs[0];
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 10000);
    try {
      const url = `https://${this.o.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`;
      const res = await (this.o.fetchImpl ?? fetch)(url, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": this.o.key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000", Accept: "application/json" },
        body: audio as unknown as BodyInit,
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`Azure STT ${res.status}`);
      return parseAzureStt((await res.json()) as AzureSttResponse, locale);
    } finally {
      clearTimeout(timer);
    }
  }
}
