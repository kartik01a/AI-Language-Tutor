import { z } from "zod";
import type { LlmProvider, LlmUsage, SttWord } from "@/lib/providers/types";
import { lookup, taxonomyFor, type TaxonomyEntry } from "@/lib/learning/taxonomy";
import { gateCorrections, type DropReason, type EditCandidate, type Level, type Strictness } from "./corrections";
import type { Lang } from "./output-validation";
import { strictJsonSchema } from "@/lib/providers/json-schema";

// Precision-first correction pipeline (docs/06 §6): detect (k samples) → vote → gate → explain.
// The LLM only proposes edits; deterministic gates decide what the learner ever sees.

export const PIPELINE_VERSION = "corr@1";

export const editsSchema = z.object({
  edits: z.array(
    z.object({
      code: z.string(),
      original: z.string().min(1),
      corrected: z.string().min(1),
      token_start: z.number().int().min(0),
      token_end: z.number().int().min(1),
      type: z.enum(["grammar", "vocab", "style"]),
    }),
  ),
});

export const explanationsSchema = z.object({
  items: z.array(z.object({ edit_id: z.string(), rule: z.string(), example: z.string() })),
});

export const EDITS_SCHEMA = { name: "edit_candidates", jsonSchema: strictJsonSchema(editsSchema) };
export const EXPLAIN_SCHEMA = { name: "explanations", jsonSchema: strictJsonSchema(explanationsSchema) };

export interface CorrectionCard {
  id: string;
  card: "fix" | "alternative" | "praise";
  errorCode: string;
  original: string;
  corrected: string;
  explanation: string;
  example: string;
  /** Show the answer only after the learner has had a go (docs/06 §6, Relaxed shows it immediately). */
  tryAgainFirst: boolean;
}

export interface DroppedCorrection {
  edit: EditCandidate;
  reason: DropReason | "unknown_code";
}

export interface PipelineInput {
  words: SttWord[];
  lang: Lang;
  level: Level;
  strictness: Strictness;
  /** Token spans the recogniser was unsure about. */
  riskSpans: [number, number][];
  /** Error codes this learner has made in ≥2 recent sessions. */
  recurrent?: Set<string>;
  samples?: number;
  /** Detection reasoning effort. Corrections run after the learner is released, so they can afford to think. */
  effort?: "none" | "low" | "medium";
  minVotes?: number;
  tauFragile?: number;
  relaxedRecastTurn?: boolean;
  /** Topic/register context; register-sensitive categories are skipped when the register fits. */
  casualRegister?: boolean;
}

export interface PipelineResult {
  cards: CorrectionCard[];
  dropped: DroppedCorrection[];
  usage: LlmUsage[];
  /** Valid detection samples obtained (< 2 means we deliberately corrected nothing). */
  validSamples: number;
}

export function buildDetectionPrompt(lang: Lang, level: Level, taxonomy: TaxonomyEntry[]): string {
  return [
    "EDIT DETECTION. You find genuine learner errors in a transcript of SPOKEN language.",
    `Learner level: ${level}. Target language: ${lang}.`,
    "Rules:",
    "- Use MINIMAL edits: change only what is wrong. Never rewrite for style or fluency.",
    "- A different but valid way of saying something is NOT an error. Return no edit for it.",
    "- The transcript has per-word confidence. Words with low confidence may be misheard: do NOT report edits on them.",
    "- Ignore disfluencies, fillers, repetitions and self-corrections.",
    "- A time word that fixes the tense (e.g. 昨日 = yesterday) requires the matching tense. Check every verb and particle against the rules below before answering.",
    "- Mark the SMALLEST span that contains the error (for a wrong particle, just the particle and the word it attaches to).",
    "- Use ONLY these error codes (skip anything that does not fit one):",
    ...taxonomy.map((t) => `  - ${t.code}: ${t.label}. ${t.cardRule} Example: "${t.example.wrong}" → "${t.example.right}"`),
    "Return JSON: {\"edits\":[{code, original, corrected, token_start, token_end, type}]} where token indices refer to the numbered tokens (end exclusive). Return {\"edits\":[]} if there are no genuine errors.",
  ].join("\n");
}

export function numberedTranscript(words: SttWord[]): string {
  return words.map((w, i) => `${i}:${w.w}${w.conf === null ? "" : `(${w.conf.toFixed(2)})`}`).join(" ");
}

/**
 * The part of an edit that actually differs: common prefix/suffix trimmed away. "公園を行きました" →
 * "公園に行きました" has the core を→に. Samples that mark different span widths still agree on the core.
 */
export function coreDiff(original: string, corrected: string): { prefix: number; orig: string; corr: string } {
  let p = 0;
  while (p < original.length && p < corrected.length && original[p] === corrected[p]) p++;
  let sfx = 0;
  while (sfx < original.length - p && sfx < corrected.length - p && original[original.length - 1 - sfx] === corrected[corrected.length - 1 - sfx]) sfx++;
  return { prefix: p, orig: original.slice(p, original.length - sfx), corr: corrected.slice(p, corrected.length - sfx) };
}

const editKey = (e: { code: string; original: string; corrected: string }) => {
  const d = coreDiff(e.original, e.corrected);
  // Fall back to the full strings if the edit has no distinguishable core (e.g. identical text).
  return d.orig === "" && d.corr === "" ? `${e.code}|${e.original}|${e.corrected}` : `${e.code}|${d.orig}|${d.corr}`;
};

/**
 * Narrow the model's span to the tokens covering the differing core, so the ASR confidence gates
 * judge the word that is actually being corrected, not its neighbours. The model's span is often
 * imprecise (too wide, or not even covering its own quote), so the quoted text is located in the
 * WHOLE transcript and the span is used only to pick between repeated occurrences. If nothing can
 * be established the original span is kept (the conservative choice).
 */
export function narrowSpan(words: SttWord[], span: [number, number], original: string, corrected: string): [number, number] {
  const d = coreDiff(original, corrected);
  if (d.orig === "") return span; // pure insertion: no token to point at
  const clean = (t: string) => t.replace(/\s/g, "");
  const needle = clean(original);
  let joined = "";
  const starts: number[] = [];
  for (const t of words) {
    starts.push(joined.length);
    joined += clean(t.w);
  }
  if (needle === "") return span;

  const tokenAt = (charPos: number) => {
    for (let i = words.length - 1; i >= 0; i--) if (starts[i] <= charPos) return i;
    return 0;
  };
  // All occurrences; prefer the one closest to the model's span.
  const hits: number[] = [];
  for (let i = joined.indexOf(needle); i >= 0; i = joined.indexOf(needle, i + 1)) hits.push(i);
  if (hits.length === 0) return span;
  const best = hits.reduce((a, b) => (Math.abs(tokenAt(a) - span[0]) <= Math.abs(tokenAt(b) - span[0]) ? a : b));

  const from = best + d.prefix;
  const to = from + d.orig.length;
  let first = -1;
  let last = -1;
  words.forEach((t, i) => {
    const s = starts[i];
    const e = s + clean(t.w).length;
    if (e > from && s < to) {
      if (first < 0) first = i;
      last = i;
    }
  });
  return first < 0 ? span : [first, last + 1];
}

export function spanConfidence(words: SttWord[], span: [number, number]): number | null {
  const slice = words.slice(span[0], span[1]);
  if (slice.length === 0 || slice.some((w) => w.conf === null)) return null;
  return Math.min(...slice.map((w) => w.conf as number));
}

export async function runCorrectionPipeline(llm: LlmProvider, input: PipelineInput): Promise<PipelineResult> {
  const k = input.samples ?? 3;
  const usage: LlmUsage[] = [];
  // Unfinished sentences are coached by the live turn call; the verified card pipeline stays on grammar errors.
  const taxonomy = taxonomyFor(input.lang).filter((t) => t.code !== "ja.sentence.incomplete" && t.code !== "ja.phrasing.unnatural");
  const empty: PipelineResult = { cards: [], dropped: [], usage, validSamples: 0 };
  if (taxonomy.length === 0 || input.words.length === 0) return empty;

  // 1. Detect: k independent samples in parallel. A failed/invalid sample is ignored, not counted against an edit.
  const req = { system: buildDetectionPrompt(input.lang, input.level, taxonomy), user: `Transcript: ${numberedTranscript(input.words)}`, schema: EDITS_SCHEMA, effort: input.effort ?? "low" };
  const settled = await Promise.allSettled(Array.from({ length: k }, () => llm.turn(req)));
  const valid: z.infer<typeof editsSchema>["edits"][] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    usage.push(s.value.usage);
    const parsed = editsSchema.safeParse(s.value.json);
    if (parsed.success) valid.push(parsed.data.edits);
  }
  const minVotes = input.minVotes ?? 2;
  // With fewer valid samples than required votes we cannot establish agreement: say nothing.
  if (valid.length < minVotes) return { ...empty, usage, validSamples: valid.length };

  // 2. Vote: an edit exists only as far as samples agree on (code, original, corrected).
  const tally = new Map<string, { edit: z.infer<typeof editsSchema>["edits"][number]; votes: number }>();
  for (const sample of valid) {
    const seen = new Set<string>();
    for (const e of sample) {
      const key = editKey(e);
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = tally.get(key);
      if (cur) cur.votes++;
      else tally.set(key, { edit: e, votes: 1 });
    }
  }

  // 3. Build candidates from taxonomy metadata (never from the model's claims about severity).
  const dropped: DroppedCorrection[] = [];
  const candidates: EditCandidate[] = [];
  let n = 0;
  for (const { edit, votes } of tally.values()) {
    const tax = lookup(edit.code);
    const wide: [number, number] = [edit.token_start, Math.min(edit.token_end, input.words.length)];
    const span = narrowSpan(input.words, wide, edit.original, edit.corrected);
    const base = { id: `e${++n}`, code: edit.code, original: edit.original, corrected: edit.corrected, span, type: edit.type, votes, samples: valid.length };
    if (!tax) {
      // An unknown code can't be gated safely: drop it.
      dropped.push({ edit: { ...base, severity: 1, asrFragile: false, validVariety: false, fastPathRecast: false, minLevel: "A1", spanConfidence: null }, reason: "unknown_code" });
      continue;
    }
    const sevAtLevel = tax.severity[input.level];
    const candidate: EditCandidate = {
      ...base,
      severity: (sevAtLevel || 1) as 1 | 2 | 3,
      asrFragile: tax.asrFragile,
      validVariety: tax.validVariety,
      registerLegitimate: tax.registerSensitive && !!input.casualRegister,
      fastPathRecast: tax.fastPathRecast,
      minLevel: tax.minLevel,
      spanConfidence: spanConfidence(input.words, span),
      recurrent: input.recurrent?.has(edit.code),
    };
    // Severity 0 in the taxonomy means "never correct this category at the learner's level".
    if (sevAtLevel === 0) dropped.push({ edit: candidate, reason: "level" });
    else candidates.push(candidate);
  }

  // 4. Gate (identical precision gates at every strictness).
  const gate = gateCorrections(candidates, {
    understood: true,
    asrRiskSpans: input.riskSpans,
    strictness: input.strictness,
    level: input.level,
    minVotes,
    tauFragile: input.tauFragile,
    relaxedRecastTurn: input.relaxedRecastTurn,
  });
  dropped.push(...gate.dropped);
  if (gate.cards.length === 0) return { cards: [], dropped, usage, validSamples: valid.length };

  // 5. Explain the kept edits (one call). Anything invalid falls back to the taxonomy's own rule.
  let explained = new Map<string, { rule: string; example: string }>();
  try {
    const r = await llm.turn({
      system: "EXPLANATION. For each edit write ONE rule sentence (≤15 words, plain English, no jargon) and ONE short example sentence in the target language. Do not restate the learner's mistake as an insult. Return JSON {\"items\":[{edit_id, rule, example}]}.",
      user: gate.cards.map((c) => `${c.id}: "${c.original}" → "${c.corrected}" [${c.code}] level ${input.level}`).join("\n"),
      schema: EXPLAIN_SCHEMA,
      effort: "none",
    });
    usage.push(r.usage);
    const parsed = explanationsSchema.safeParse(r.json);
    if (parsed.success) explained = new Map(parsed.data.items.map((i) => [i.edit_id, { rule: i.rule, example: i.example }]));
  } catch {
    /* fall back to taxonomy text */
  }

  const cards: CorrectionCard[] = gate.cards.map((c) => {
    const tax = lookup(c.code) as TaxonomyEntry;
    const ex = explained.get(c.id);
    const ok = ex && ex.rule.trim().split(/\s+/).length <= 15 && ex.rule.trim().length > 0 && ex.example.trim().length > 0;
    return {
      id: c.id,
      card: c.card,
      errorCode: c.code,
      original: c.original,
      corrected: c.corrected,
      explanation: ok ? ex.rule.trim() : tax.cardRule,
      example: ok ? ex.example.trim() : tax.example.right,
      tryAgainFirst: input.strictness !== "relaxed",
    };
  });
  return { cards, dropped, usage, validSamples: valid.length };
}

/**
 * Fast-path spoken recast (docs/06 §6): from the turn call's single `recast_candidate`, before the
 * full pipeline has run. Only high-confidence, common categories, never inside ASR-risk spans. ASR-fragile
 * categories (particles…) are allowed only when every word involved was recognised with high confidence.
 */
/** Fragile short words (particles) may be recast on the fast path only above this word confidence. */
const FRAGILE_FAST_CONFIDENCE = 0.85;

export function fastPathRecastAllowed(
  candidate: { error_code: string; original: string; corrected: string } | null,
  ctx: { words: SttWord[]; riskSpans: [number, number][]; level: Level; strictness: Strictness; relaxedRecastTurn?: boolean; recurrent?: Set<string> },
): boolean {
  if (!candidate) return false;
  const tax = lookup(candidate.error_code);
  if (!tax || !tax.fastPathRecast || tax.validVariety) return false;
  const sev = tax.severity[ctx.level];
  if (sev === 0) return false;
  if (ctx.strictness === "relaxed") return !!ctx.relaxedRecastTurn && sev === 3 && !!ctx.recurrent?.has(candidate.error_code);
  if (sev < (ctx.strictness === "strict" ? 1 : 2)) return false;
  // The corrected phrase must actually occur in what was heard, otherwise it isn't an echo of this turn.
  const heard = ctx.words.map((w) => w.w).join("");
  const around = candidate.original.replace(/\s/g, "");
  if (!heard.includes(around)) return false;
  if (tax.asrFragile) {
    const involved = ctx.words.filter((w) => around.includes(w.w));
    if (involved.length === 0 || involved.some((w) => w.conf === null || w.conf < FRAGILE_FAST_CONFIDENCE)) return false;
  }
  // No low-confidence word anywhere in the sentence may sit inside the recast's text.
  return !ctx.riskSpans.some(([s, e]) => ctx.words.slice(s, e).some((w) => around.includes(w.w)));
}
