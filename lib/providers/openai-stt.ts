import type { SttProvider, SttResult } from "./types";

// OpenAI transcription (gpt-transcribe). Returns NO confidence (docs/research/notes/stt-and-llm.md): every
// word has conf = null, which downstream gates treat as "unknown", never as "certain".

export interface OpenAiSttOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class OpenAiStt implements SttProvider {
  constructor(private o: OpenAiSttOptions) {}

  async transcribe(audio: Uint8Array, mime: string, langs: string[]): Promise<SttResult> {
    const ext = mime.includes("wav") ? "wav" : mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
    const form = new FormData();
    form.append("file", new Blob([audio as BlobPart], { type: mime }), `audio.${ext}`);
    form.append("model", this.o.model ?? "gpt-transcribe");
    // A single ISO code; the primary language only (we never put the expected answer in a prompt).
    form.append("language", langs[0]);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 15000);
    try {
      const res = await (this.o.fetchImpl ?? fetch)("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.o.apiKey}` },
        body: form,
        signal: ctl.signal,
      });
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(`OpenAI STT ${res.status}: ${j.error?.message ?? "failed"}`);
      const text = (j.text ?? "").trim();
      return { text, words: text ? [{ w: text, conf: null }] : [], lang: langs[0], langConf: null };
    } finally {
      clearTimeout(timer);
    }
  }
}
