import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { mapAzureVisemes, type AzureVisemeEvent } from "../avatar/visemes";
import type { TtsProvider, TtsResult, VoiceConfig } from "./types";

// Azure AI Speech TTS (docs/05 §5). Standard neural voices only: HD voices lose visemes and rate control.

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Replace spans with Azure's pronunciation substitution: [{ text: "今日", alias: "きょう" }]. */
export interface ReadingOverride {
  text: string;
  alias: string;
}

export function buildSsml(text: string, voice: Pick<VoiceConfig, "voiceName" | "locale" | "rate">, overrides: ReadingOverride[] = []): string {
  // Escape first, then wrap overridden substrings in <sub alias> in ONE pass. Longest-first alternation
  // means "一日中" wins over "一日", and already-wrapped text is never matched again.
  let body = escapeXml(text);
  if (overrides.length > 0) {
    const byText = new Map(overrides.map((o) => [escapeXml(o.text), o.alias]));
    const keys = [...byText.keys()].sort((x, y) => y.length - x.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    body = body.replace(new RegExp(keys.join("|"), "g"), (m) => `<sub alias="${escapeXml(byText.get(m) as string)}">${m}</sub>`);
  }
  const rate = voice.rate && voice.rate !== "0%" ? ` rate="${escapeXml(voice.rate)}"` : "";
  const inner = rate ? `<prosody${rate}>${body}</prosody>` : body;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(voice.locale)}"><voice name="${escapeXml(voice.voiceName)}">${inner}</voice></speak>`;
}

export interface AzureTtsOptions {
  key: string;
  region: string;
  /** Per-call reading overrides (e.g. from the Japanese reading pipeline). */
  overridesFor?: (text: string) => ReadingOverride[];
}

export class AzureTts implements TtsProvider {
  constructor(private o: AzureTtsOptions) {}

  async synthesize(text: string, voice: VoiceConfig): Promise<TtsResult> {
    const config = sdk.SpeechConfig.fromSubscription(this.o.key, this.o.region);
    config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    // `null` audio config: don't play through a speaker, just return the bytes.
    const synth = new sdk.SpeechSynthesizer(config, undefined as unknown as sdk.AudioConfig);
    const visemes: AzureVisemeEvent[] = [];
    synth.visemeReceived = (_s, e) => visemes.push({ visemeId: e.visemeId, audioOffset: e.audioOffset });

    const ssml = buildSsml(text, voice, this.o.overridesFor?.(text) ?? []);
    try {
      const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) =>
        synth.speakSsmlAsync(ssml, (r) => (r.reason === sdk.ResultReason.SynthesizingAudioCompleted ? resolve(r) : reject(new Error(r.errorDetails || `TTS failed (${sdk.ResultReason[r.reason]})`))), reject),
      );
      // audioDuration is in 100-ns ticks.
      const durationMs = result.audioDuration / 10_000;
      return {
        audio: new Uint8Array(result.audioData),
        format: "mp3",
        visemes: mapAzureVisemes(visemes, { locale: voice.locale, totalMs: durationMs }),
        durationMs,
        // Azure bills each kanji as two characters; markup counts too (docs/12).
        billableChars: [...ssml.replace(/<speak[^>]*>|<\/speak>|<voice[^>]*>|<\/voice>/g, "")].reduce((n, ch) => n + (/[㐀-鿿]/.test(ch) ? 2 : 1), 0),
      };
    } finally {
      synth.close();
    }
  }
}
