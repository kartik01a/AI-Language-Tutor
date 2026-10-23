import { z } from "zod";

// Strict turn-call output (docs/06 §5.2). Key order matters: analysis first so the
// dialogue machine can decide before any reply text reaches TTS.

export const turnCategorySchema = z.enum([
  "understood",
  "partially_understood",
  "not_understood",
  "off_topic",
  "native_language_help",
  "native_language_answer",
  "dont_know",
  "meta_request",
  "unsafe",
]);

const hintsSchema = z.object({
  hint: z.string(),
  starter: z.string(),
  example: z.string(),
  example_translation: z.string(),
});
const wordsSchema = z.array(z.object({ lemma: z.string(), reading: z.string().nullable(), meaning: z.string() }));

export const turnOutputSchema = z.object({
  analysis: z.object({
    category: turnCategorySchema,
    /** The topic the learner chose to talk about (e.g. "食べ物"), or null if they haven't chosen one yet (just a greeting, a name…). */
    topic: z.string().nullable(),
    meaning_summary: z.string().max(200),
    recovered_fragment: z.string().nullable(),
    off_topic_reason: z.enum(["learner_steering", "misunderstood_question"]).nullable(),
    meta: z.object({
      kind: z.enum(["repeat", "slower", "meaning"]).nullable(),
      word: z.string().nullable(),
    }),
    goal_progress: z.array(z.object({ goal_id: z.string(), achieved: z.boolean() })),
    recast_candidate: z
      .object({ error_code: z.string(), original: z.string(), corrected: z.string() })
      .nullable(),
  }),
  reply: z.object({
    recast: z.string().nullable(),
    sentences: z.array(z.string().min(1)).min(1).max(5),
    translation: z.array(z.string()),
    teach_phrase: z.object({ text: z.string(), translation: z.string() }).nullable(),
  }),
  // Optional: the live turn call no longer asks for these (every output token costs ~10 ms of waiting).
  // They come from `enrichSchema`, requested in parallel while the tutor speaks.
  hints: hintsSchema.optional(),
  words_introduced: wordsSchema.optional(),
});

/** What the live turn call is asked for: the decision and the reply, nothing else. */
export const turnCoreSchema = turnOutputSchema.omit({ hints: true, words_introduced: true });

/** Hints for the question just asked, plus new words: generated beside the reply, off the critical path. */
export const enrichSchema = z.object({ hints: hintsSchema, words_introduced: wordsSchema });
export type Enrichment = z.infer<typeof enrichSchema>;

export type TurnOutput = z.infer<typeof turnOutputSchema>;
export type LlmCategory = z.infer<typeof turnCategorySchema>;

/**
 * Consistency downgrades applied after the LLM classifies (docs/06 §4.2).
 * Code never lets the model claim understanding the evidence doesn't support.
 */
export function reconcileCategory(
  out: TurnOutput,
  evidence: { borderlineConfidence: boolean; hasNonTargetTokens: boolean },
): LlmCategory {
  const { category, meaning_summary } = out.analysis;
  if (category === "understood") {
    if (meaning_summary.trim() === "") return "partially_understood";
    if (evidence.borderlineConfidence) return "partially_understood";
  }
  if (
    (category === "native_language_help" || category === "native_language_answer") &&
    !evidence.hasNonTargetTokens
  ) {
    return "not_understood";
  }
  return category;
}
