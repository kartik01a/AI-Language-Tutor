// Deterministic correction gates (docs/06 §6, docs/07 §3.4).
// The LLM proposes edits; this code decides which ones the learner ever sees.
// The precision gates are IDENTICAL at every strictness level: strictness only
// changes how many / which surviving edits are shown.

export type Strictness = "relaxed" | "balanced" | "strict";
export type Level = "A1" | "A2" | "B1" | "B2";
const LEVEL_ORDER: Level[] = ["A1", "A2", "B1", "B2"];

export type EditType = "grammar" | "vocab" | "style";

export interface EditCandidate {
  id: string;
  /** Taxonomy code, e.g. "ja.particle.destination". */
  code: string;
  original: string;
  corrected: string;
  /** Token-index span [start, end) in the learner transcript. */
  span: [number, number];
  type: EditType;
  /** Taxonomy severity at the learner's level: 1 minor … 3 meaning-impeding. */
  severity: 1 | 2 | 3;
  /** Number of detection samples (out of `samples`) that proposed this edit. */
  votes: number;
  samples: number;
  /** Taxonomy flags. */
  asrFragile: boolean;
  validVariety: boolean;
  /** Edit is legitimate in this register/topic (e.g. plain form in a casual topic). */
  registerLegitimate?: boolean;
  fastPathRecast: boolean;
  minLevel: Level;
  /** Lowest ASR word confidence over the span (null = unknown). */
  spanConfidence: number | null;
  /** Learner has made this error in ≥2 recent sessions. */
  recurrent?: boolean;
}

export interface GateContext {
  /** Turn was classified UNDERSTOOD; anything else gets no corrections. */
  understood: boolean;
  /** Token-index spans [start, end) the recogniser was unsure about. */
  asrRiskSpans: [number, number][];
  strictness: Strictness;
  level: Level;
  /** Minimum agreeing samples, e.g. 2 of 3. */
  minVotes?: number;
  /** Stricter confidence needed for ASR-fragile categories. */
  tauFragile?: number;
  /** Tokens of margin around risk spans that also count as risky. */
  neighbourMargin?: number;
  /** True on turns where Relaxed mode may still recast (every other turn). */
  relaxedRecastTurn?: boolean;
}

export type DropReason =
  | "category"
  | "asr_risk"
  | "votes"
  | "fragile_confidence"
  | "variety"
  | "register"
  | "level"
  | "style_not_strict"
  | "strictness"
  | "cap";

export interface GateResult {
  /** Edits shown as cards (type "style" → card "alternative", others → "fix"). */
  cards: (EditCandidate & { card: "fix" | "alternative" })[];
  /** At most one edit eligible for a spoken recast. */
  recast: EditCandidate | null;
  dropped: { edit: EditCandidate; reason: DropReason }[];
}

const CAPS: Record<Strictness, { cards: number; minSeverity: 1 | 2 | 3 }> = {
  relaxed: { cards: 1, minSeverity: 3 },
  balanced: { cards: 2, minSeverity: 2 },
  strict: { cards: 5, minSeverity: 1 },
};

function overlapsRisk(span: [number, number], risks: [number, number][], margin: number): boolean {
  const [s, e] = span;
  return risks.some(([rs, re]) => s < re + margin && e > rs - margin);
}

export function gateCorrections(edits: EditCandidate[], ctx: GateContext): GateResult {
  const dropped: GateResult["dropped"] = [];
  const kept: EditCandidate[] = [];

  if (!ctx.understood) {
    return { cards: [], recast: null, dropped: edits.map((edit) => ({ edit, reason: "category" as const })) };
  }

  const minVotes = ctx.minVotes ?? 2;
  const tauFragile = ctx.tauFragile ?? 0.85;
  const margin = ctx.neighbourMargin ?? 1;

  for (const edit of edits) {
    // Precision gates: same at every strictness level.
    if (overlapsRisk(edit.span, ctx.asrRiskSpans, margin)) {
      dropped.push({ edit, reason: "asr_risk" });
    } else if (edit.votes < minVotes) {
      dropped.push({ edit, reason: "votes" });
    } else if (edit.validVariety) {
      dropped.push({ edit, reason: "variety" });
    } else if (edit.registerLegitimate) {
      dropped.push({ edit, reason: "register" });
    } else if (LEVEL_ORDER.indexOf(ctx.level) < LEVEL_ORDER.indexOf(edit.minLevel)) {
      dropped.push({ edit, reason: "level" });
    } else if (edit.asrFragile && (edit.spanConfidence === null || edit.spanConfidence < tauFragile)) {
      // Unknown confidence is treated as unsafe for fragile categories.
      dropped.push({ edit, reason: "fragile_confidence" });
    } else if (edit.type === "style" && ctx.strictness !== "strict") {
      dropped.push({ edit, reason: "style_not_strict" });
    } else {
      kept.push(edit);
    }
  }

  // Strictness: only which surviving edits are shown, never the gates above.
  const policy = CAPS[ctx.strictness];
  const eligible: EditCandidate[] = [];
  for (const edit of kept) {
    if (edit.type !== "style" && edit.severity < policy.minSeverity) {
      dropped.push({ edit, reason: "strictness" });
    } else {
      eligible.push(edit);
    }
  }

  // Prioritise: severity, then recurrence, then earlier in the utterance.
  eligible.sort(
    (a, b) =>
      b.severity - a.severity ||
      Number(!!b.recurrent) - Number(!!a.recurrent) ||
      a.span[0] - b.span[0],
  );

  const cards = eligible.slice(0, policy.cards).map((e) => ({
    ...e,
    card: (e.type === "style" ? "alternative" : "fix") as "fix" | "alternative",
  }));
  for (const edit of eligible.slice(policy.cards)) dropped.push({ edit, reason: "cap" });

  // Spoken recast: at most one, only for fast-path categories (docs/06 §6).
  let recast: EditCandidate | null = null;
  const recastable = eligible.filter((e) => e.fastPathRecast && e.type !== "style");
  if (ctx.strictness === "relaxed") {
    recast = ctx.relaxedRecastTurn
      ? (recastable.find((e) => e.severity === 3 && e.recurrent) ?? null)
      : null;
  } else {
    recast = recastable.find((e) => e.severity >= 2) ?? null;
  }

  return { cards, recast, dropped };
}
