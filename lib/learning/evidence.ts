import type { SessionMetrics } from "@/lib/session/store";

// PROVISIONAL evidence mapping (docs/08 §5): turns one session's metrics into a per-skill evidence
// value x on the same scale as θ. Weights are placeholders to be tuned against teacher ratings in
// Phase 7. By design every signal is expressed as an adjustment around the current θ, clamped, so
// no single metric can swing the estimate, and a skill with no measurable signal gets x = θ.

export type SkillName = "grammar" | "vocabulary" | "fluency" | "comprehension";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface EvidenceInput {
  metrics: SessionMetrics;
  /** Corrections shown AND confirmed by the verifier. */
  verifiedCards: number;
}

export function evidenceFor(skill: SkillName, theta: number, i: EvidenceInput): number {
  const turns = Math.max(1, i.metrics.learnerTurns);
  switch (skill) {
    case "grammar": {
      // ~0.5 verified cards per turn is typical; fewer is better. Lower bound only (ASR hides errors).
      const perTurn = i.verifiedCards / turns;
      return theta + clamp((0.5 - perTurn) * 0.8, -0.5, 0.4);
    }
    case "comprehension": {
      // Fewer unclear turns and less reliance on hints → better.
      const unclear = i.metrics.unclearTurns / turns;
      const hints = i.metrics.hintsUsed / turns;
      return theta + clamp(0.3 - unclear * 1.5 - hints * 0.3, -0.5, 0.3);
    }
    case "fluency": {
      const meanTurnSec = i.metrics.learnerSpeechMs / 1000 / turns;
      return theta + clamp((meanTurnSec - 4) / 10, -0.4, 0.4);
    }
    case "vocabulary":
      // Needs lexical diversity aggregated across sessions; no reliable single-session signal yet.
      return theta;
  }
}

export const SKILLS: SkillName[] = ["grammar", "vocabulary", "fluency", "comprehension"];
