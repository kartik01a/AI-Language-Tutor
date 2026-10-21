import type { VisemeEvent } from "@/lib/avatar/visemes";

// Provider interfaces (docs/04 §8). Everything vendor-specific lives behind these.

export interface SttWord {
  w: string;
  /** 0–1; null = the provider gives no confidence (forces stricter gating). */
  conf: number | null;
  start?: number;
  end?: number;
}

export interface SttResult {
  text: string;
  words: SttWord[];
  lang: string | null;
  langConf: number | null;
}

export interface SttProvider {
  transcribe(audio: Uint8Array, mime: string, langs: string[]): Promise<SttResult>;
}

export interface LlmUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface LlmRequest {
  /** Static, cacheable prefix. */
  system: string;
  /** Per-turn dynamic content. */
  user: string;
  /** Strict output schema (JSON Schema). Providers that support it enforce the shape. */
  schema?: { name: string; jsonSchema: Record<string, unknown> };
  /** Reasoning effort: "none" for latency-critical tutor turns, "low" for end-of-session analysis. */
  effort?: "none" | "low" | "medium";
}

export interface LlmProvider {
  /** Returns parsed JSON (validated by the caller) plus token usage for cost accounting. */
  turn(req: LlmRequest): Promise<{ json: unknown; usage: LlmUsage }>;
}

export interface VoiceConfig {
  provider: string;
  voiceName: string;
  locale: string;
  /** SSML prosody rate, e.g. "-12%". */
  rate?: string;
}

export interface TtsResult {
  audio: Uint8Array;
  format: "mp3" | "wav";
  visemes: VisemeEvent[];
  durationMs: number;
  billableChars: number;
}

export interface TtsProvider {
  synthesize(text: string, voice: VoiceConfig): Promise<TtsResult>;
}
