import { z } from "zod";
import type { LlmProvider, LlmUsage } from "@/lib/providers/types";
import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";
import { initialEstimate, isQualifyingSession, likelyRange, updateEstimate, type CefrBand, type SkillEstimate } from "./level-estimate";
import { evidenceFor, SKILLS, type SkillName } from "./evidence";
import type { SessionMetrics } from "@/lib/session/store";

// End-of-session analysis (docs/08 §4): verify → summarise → level update.

const verifySchema = z.object({ verdicts: z.array(z.object({ card_id: z.string(), agree: z.boolean() })) });
const summarySchema = z.object({
  did_well: z.array(z.object({ text: z.string().min(1).max(160), evidence: z.string().min(1).max(120) })).max(5),
  next_focus: z.string().max(160),
});

export type Skills = Record<SkillName, SkillEstimate>;

export function initialSkills(level: CefrBand): Skills {
  return Object.fromEntries(SKILLS.map((s) => [s, initialEstimate(level)])) as Skills;
}

/** Shown level = the weakest of grammar and comprehension, so the tutor errs on being understood (docs/08 §1). */
export function overallLevel(skills: Skills): CefrBand {
  const order: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const g = order.indexOf(skills.grammar.displayed);
  const c = order.indexOf(skills.comprehension.displayed);
  return order[Math.min(g, c)];
}

export interface SessionSummary {
  /** "complete" or "partial" (e.g. the connection dropped). */
  status: "complete" | "partial";
  didWell: { text: string; evidence: string }[];
  fixes: CorrectionCard[];
  /** Cards the verifier disagreed with: shown softly, never counted against the learner. */
  worthASecondLook: CorrectionCard[];
  newWords: { lemma: string; reading: string | null; meaning: string }[];
  stats: { speakingSeconds: number; turns: number; hintsUsed: number; unclearTurns: number };
  level: {
    before: CefrBand;
    after: CefrBand;
    changed: boolean;
    /** False when the session was too short or too noisy to move the estimate. */
    updated: boolean;
    reason: string | null;
    likely: [CefrBand, CefrBand];
  };
  nextFocus: string | null;
  skills: Skills;
}

export interface SummaryInput {
  llm: LlmProvider;
  endReason: string;
  learnerLines: string[];
  cards: CorrectionCard[];
  reportedCardIds: Set<string>;
  metrics: SessionMetrics;
  skills: Skills;
  nonUnderstandingRate: number;
}

export async function summariseSession(input: SummaryInput): Promise<{ summary: SessionSummary; usage: LlmUsage[] }> {
  const usage: LlmUsage[] = [];
  const reported = input.reportedCardIds;
  // Cards the learner flagged as wrong are never presented as fixes or counted.
  const candidates = input.cards.filter((c) => !reported.has(c.id));

  // 1. Verify: an independent pass that may only REMOVE corrections (never add) — a different
  //    prompt from detection, because asking the same model to double-check itself is unreliable.
  let agreed = new Set(candidates.map((c) => c.id));
  if (candidates.length > 0) {
    try {
      const r = await input.llm.turn({
        system: "VERIFY CORRECTIONS. For each correction decide whether the learner's original is a genuine error that the corrected form fixes, and the correction is not merely a stylistic preference or a valid alternative. Be strict: agree only when clearly an error. Return JSON {\"verdicts\":[{card_id, agree}]}.",
        user: candidates.map((c) => `${c.id}: "${c.original}" → "${c.corrected}" [${c.errorCode}]`).join("\n"),
      });
      usage.push(r.usage);
      const parsed = verifySchema.safeParse(r.json);
      if (parsed.success) {
        const verdict = new Map(parsed.data.verdicts.map((v) => [v.card_id, v.agree]));
        // Missing verdict = not confirmed.
        agreed = new Set(candidates.filter((c) => verdict.get(c.id) === true).map((c) => c.id));
      } else agreed = new Set();
    } catch {
      // Verifier unavailable: don't present unverified corrections as fixes.
      agreed = new Set();
    }
  }
  const fixes = candidates.filter((c) => agreed.has(c.id));
  const worthASecondLook = candidates.filter((c) => !agreed.has(c.id));

  // 2. Summary: praise must quote the learner. Items whose evidence isn't actually in the transcript are dropped.
  let didWell: SessionSummary["didWell"] = [];
  let nextFocus: string | null = null;
  if (input.learnerLines.length > 0) {
    try {
      const r = await input.llm.turn({
        system: "SESSION SUMMARY. Give 1–3 specific things the learner did well, each with `evidence`: an exact short quote from the learner's lines. Do not invent praise. Also give one `next_focus` suggestion. Return JSON {\"did_well\":[{text, evidence}],\"next_focus\":string}.",
        user: `Learner lines:\n${input.learnerLines.map((l) => `- ${l}`).join("\n")}\nVerified fixes: ${fixes.map((f) => f.errorCode).join(", ") || "none"}`,
      });
      usage.push(r.usage);
      const parsed = summarySchema.safeParse(r.json);
      if (parsed.success) {
        const haystack = input.learnerLines.join("\n");
        didWell = parsed.data.did_well.filter((d) => haystack.includes(d.evidence)).slice(0, 3);
        nextFocus = parsed.data.next_focus.trim() || null;
      }
    } catch {
      /* the summary still works without praise text */
    }
  }

  // 3. Level update (provisional evidence, hysteresis, qualifying sessions only).
  const before = overallLevel(input.skills);
  const quality = { learnerSpeechSeconds: input.metrics.learnerSpeechMs / 1000, nonUnderstandingRate: input.nonUnderstandingRate };
  const qualifies = isQualifyingSession(quality);
  const skills = { ...input.skills };
  if (qualifies) {
    for (const s of SKILLS) {
      skills[s] = updateEstimate(skills[s], evidenceFor(s, skills[s].theta, { metrics: input.metrics, verifiedCards: fixes.length }), quality);
    }
  }
  const after = overallLevel(skills);
  const reason = qualifies
    ? null
    : quality.learnerSpeechSeconds < 60
      ? "This conversation was too short to update your level estimate."
      : "Too many unclear moments, so your level estimate wasn't changed.";

  return {
    usage,
    summary: {
      status: input.endReason === "disconnect" || input.endReason === "error" ? "partial" : "complete",
      didWell,
      fixes,
      worthASecondLook,
      newWords: input.metrics.wordsIntroduced,
      stats: {
        speakingSeconds: Math.round(input.metrics.learnerSpeechMs / 1000),
        turns: input.metrics.learnerTurns,
        hintsUsed: input.metrics.hintsUsed,
        unclearTurns: input.metrics.unclearTurns,
      },
      level: { before, after, changed: before !== after, updated: qualifies, reason, likely: likelyRange(skills.grammar) },
      nextFocus,
      skills,
    },
  };
}
