import { strictJsonSchema } from "@/lib/providers/json-schema";
import type { LlmProvider, LlmUsage } from "@/lib/providers/types";
import { enrichSchema, type Enrichment } from "./schemas";
import type { Level } from "./corrections";

/**
 * Hints and new words used to be part of the live turn call. That made every reply wait for ~80 extra output
 * tokens nobody needs until the NEXT turn, so they are requested separately while the tutor is speaking.
 */
export const ENRICH_SCHEMA = { name: "turn_enrichment", jsonSchema: strictJsonSchema(enrichSchema) };

export const ENRICH_SYSTEM = [
  "HINTS AND WORDS. You help a Japanese learner answer their tutor's question. Return JSON matching the schema.",
  "- hint: ONE short English sentence telling the learner what kind of answer to give (not the answer itself).",
  "- starter: a Japanese sentence frame with ___ for the learner to complete, at the learner's level.",
  "- example: one complete Japanese answer the learner could say, at their level, in polite style.",
  "- example_translation: English meaning of the example.",
  "- words_introduced: up to 3 genuinely new or useful words the TUTOR used in its reply (lemma, kana reading if the lemma has kanji, English meaning). Skip very basic words (です, はい). Empty array if none.",
].join("\n");

export async function enrichTurn(
  llm: LlmProvider,
  input: { level: Level; question: string; tutorReply: string[]; learnerText: string },
): Promise<{ enrichment: Enrichment; usage: LlmUsage } | null> {
  try {
    const r = await llm.turn({
      system: ENRICH_SYSTEM,
      user: [`Learner level: ${input.level}`, `Learner just said: ${input.learnerText}`, `Tutor replied: ${input.tutorReply.join(" ")}`, `Tutor's question to answer: ${input.question}`].join("\n"),
      schema: ENRICH_SCHEMA,
      effort: "none",
    });
    const parsed = enrichSchema.safeParse(r.json);
    return parsed.success ? { enrichment: parsed.data, usage: r.usage } : null;
  } catch {
    return null;
  }
}

/** The question the learner has to answer next: the last sentence ending in a question mark, else the last sentence. */
export function questionOf(sentences: string[]): string {
  return [...sentences].reverse().find((s) => /[?？]/.test(s)) ?? sentences[sentences.length - 1] ?? "";
}
