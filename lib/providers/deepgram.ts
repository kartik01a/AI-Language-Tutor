import type { SttProvider, SttResult, SttWord } from "./types";

// Deepgram pre-recorded STT (docs/04 §3). Training opt-out is sent on EVERY request (`mip_opt_out`).

export interface DeepgramOptions {
  apiKey: string;
  model?: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Use Deepgram's multilingual mode instead of the first requested language. */
  multi?: boolean;
}

interface DgWord { word: string; start: number; end: number; confidence: number; language?: string }
interface DgResponse {
  results?: { channels?: { alternatives?: { transcript: string; confidence: number; words?: DgWord[] }[]; detected_language?: string }[] };
}

export function buildDeepgramUrl(model: string, lang: string, multi = false): string {
  const q = new URLSearchParams({
    model,
    language: multi ? "multi" : lang,
    smart_format: "false", // keep the raw words: formatting can hide learner errors
    punctuate: "false",
    mip_opt_out: "true", // never let our learners' audio improve Deepgram's models
  });
  return `https://api.deepgram.com/v1/listen?${q}`;
}

export class DeepgramStt implements SttProvider {
  constructor(private o: DeepgramOptions) {}

  async transcribe(audio: Uint8Array, mime: string, langs: string[]): Promise<SttResult> {
    const f = this.o.fetchImpl ?? fetch;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 8000);
    try {
      const res = await f(buildDeepgramUrl(this.o.model ?? "nova-3", langs[0], this.o.multi), {
        method: "POST",
        headers: { Authorization: `Token ${this.o.apiKey}`, "Content-Type": mime || "application/octet-stream" },
        body: audio as unknown as BodyInit,
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`Deepgram ${res.status}`);
      return parseDeepgram((await res.json()) as DgResponse, langs[0]);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function parseDeepgram(j: DgResponse, requestedLang: string): SttResult {
  const ch = j.results?.channels?.[0];
  const alt = ch?.alternatives?.[0];
  if (!alt) return { text: "", words: [], lang: null, langConf: null };
  const words: SttWord[] = (alt.words ?? []).map((w) => ({
    w: w.word,
    conf: typeof w.confidence === "number" ? w.confidence : null,
    start: w.start,
    end: w.end,
  }));
  return {
    text: alt.transcript.trim(),
    words,
    // With a fixed language Deepgram returns no detection result; the language is what we asked for.
    lang: ch?.detected_language ?? requestedLang,
    langConf: null,
  };
}
