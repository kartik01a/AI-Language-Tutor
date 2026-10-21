import type { SttResult } from "@/lib/providers/types";
import { isPhantomTranscript } from "./output-validation";

// Deterministic gates between STT and the LLM (docs/06 §4.1). Thresholds are per
// language × provider and calibrated in Phase 2; these defaults are provisional.

export interface GateThresholds {
  tauWord: number;
  tauMean: number;
  /** Below tauMean but at least this: plausible enough to ask "Did you say …?" instead of rejecting. */
  tauConfirm: number;
  tauLang: number;
  /** Fraction of content words below tauWord that makes the whole clip "unclear". */
  maxLowFraction: number;
  borderlineBand: number;
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  tauWord: 0.6,
  tauMean: 0.7,
  tauConfirm: 0.4,
  tauLang: 0.5,
  maxLowFraction: 0.4,
  borderlineBand: 0.05,
};

export interface ClipInfo {
  speechMs: number;
  clipMs: number;
}

export interface GateOutcome {
  /** Set when a gate rejects the turn before the LLM sees it. */
  rejected: "NO_SPEECH" | "UNCLEAR_AUDIO" | "CONFIRM_HEARD" | null;
  reason: string | null;
  /** Token-index spans [start, end) the recogniser was unsure about. */
  riskSpans: [number, number][];
  borderline: boolean;
  confidenceKnown: boolean;
  meanConf: number | null;
}

export function applyGates(
  clip: ClipInfo,
  asr: SttResult,
  opts: { minSpeechMs: number; allowedLangs: string[]; thresholds?: GateThresholds },
): GateOutcome {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const base = { riskSpans: [] as [number, number][], borderline: false, confidenceKnown: false, meanConf: null as number | null };

  // G1: client VAD result
  if (clip.speechMs < opts.minSpeechMs || clip.clipMs < 800) {
    return { ...base, rejected: "NO_SPEECH", reason: "too_short_or_silent" };
  }
  // G2: empty / phantom / loop
  if (isPhantomTranscript(asr.text)) return { ...base, rejected: "NO_SPEECH", reason: "phantom_or_empty" };

  // G3: language check (unknown language info is not a failure)
  if (asr.lang && !opts.allowedLangs.includes(asr.lang.split("-")[0])) {
    return { ...base, rejected: "UNCLEAR_AUDIO", reason: "unexpected_language" };
  }
  if (asr.langConf !== null && asr.langConf < t.tauLang) {
    return { ...base, rejected: "UNCLEAR_AUDIO", reason: "low_language_confidence" };
  }

  // G4: word confidence
  const known = asr.words.filter((w) => w.conf !== null);
  if (known.length === 0) return { ...base, rejected: null, reason: null };

  const confs = known.map((w) => w.conf as number);
  const mean = confs.reduce((a, b) => a + b, 0) / confs.length;

  const riskSpans: [number, number][] = [];
  let low = 0;
  asr.words.forEach((w, i) => {
    if (w.conf !== null && w.conf < t.tauWord) {
      low++;
      const last = riskSpans[riskSpans.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else riskSpans.push([i, i + 1]);
    }
  });

  const out = { riskSpans, confidenceKnown: true, meanConf: mean };
  if (mean < t.tauMean || low / asr.words.length > t.maxLowFraction) {
    // Plausible but not trustworthy → ask the learner to confirm what we heard. Only when there is
    // something to show and the recogniser was not hopelessly unsure.
    const worthConfirming = mean >= t.tauConfirm && /[\p{L}\p{N}]/u.test(asr.text);
    return { ...out, borderline: false, rejected: worthConfirming ? "CONFIRM_HEARD" : "UNCLEAR_AUDIO", reason: worthConfirming ? "confirm_heard" : "low_confidence" };
  }
  return { ...out, borderline: mean < t.tauMean + t.borderlineBand, rejected: null, reason: null };
}

/** Marks word confidences for the prompt: 公園(0.97) を(0.41) 行きました(0.95) */
export function annotateTranscript(asr: SttResult): string {
  return asr.words.map((w) => (w.conf === null ? w.w : `${w.w}(${w.conf.toFixed(2)})`)).join(" ");
}

const NON_TARGET: Record<string, RegExp> = {
  ja: /[A-Za-zऀ-ॿ]/,
  de: /[ऀ-ॿ぀-ヿ㐀-鿿]/,
  en: /[ऀ-ॿ぀-ヿ㐀-鿿]/,
};

export function hasNonTargetTokens(asr: SttResult, target: string): boolean {
  if (asr.lang && asr.lang.split("-")[0] !== target) return true;
  return (NON_TARGET[target] ?? /$^/).test(asr.text);
}
