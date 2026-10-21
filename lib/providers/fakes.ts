import type { LlmProvider, LlmRequest, SttProvider, SttResult, TtsProvider, TtsResult } from "./types";

// Deterministic fakes for tests and `PROVIDERS=fake` local development.

export class FakeStt implements SttProvider {
  calls = 0;
  constructor(private script: (SttResult | Error)[] | ((n: number) => SttResult | Error)) {}
  async transcribe(): Promise<SttResult> {
    const r = typeof this.script === "function" ? this.script(this.calls) : this.script[Math.min(this.calls, this.script.length - 1)];
    this.calls++;
    if (r instanceof Error) throw r;
    return r;
  }
}

export class FakeLlm implements LlmProvider {
  calls: LlmRequest[] = [];
  constructor(private script: (unknown | Error)[] | ((n: number, req: LlmRequest) => unknown | Error)) {}
  async turn(req: LlmRequest) {
    const n = this.calls.length;
    this.calls.push(req);
    const r = typeof this.script === "function" ? this.script(n, req) : this.script[Math.min(n, this.script.length - 1)];
    if (r instanceof Error) throw r;
    return { json: r, usage: { inputTokens: 3000, cachedInputTokens: 2000, outputTokens: 250 } };
  }
}

export class FakeTts implements TtsProvider {
  calls: string[] = [];
  async synthesize(text: string): Promise<TtsResult> {
    this.calls.push(text);
    return { format: "mp3", audio: new Uint8Array([0xff, 0xfb]), visemes: [{ t: 0, v: "a" }], durationMs: text.length * 80, billableChars: text.length };
  }
}

export const stt = (text: string, conf: number | number[] | null = 0.95, lang = "ja"): SttResult => {
  const parts = text.split(" ").filter(Boolean);
  return {
    text,
    words: parts.map((w, i) => ({ w, conf: conf === null ? null : Array.isArray(conf) ? conf[i] : conf })),
    lang,
    langConf: 0.98,
  };
};
