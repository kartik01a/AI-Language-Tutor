import type { LlmProvider } from "@/lib/providers/types";
import { SUMMARY_SCHEMA, VERIFY_SCHEMA } from "@/lib/learning/summary";
import { EDITS_SCHEMA, EXPLAIN_SCHEMA } from "@/lib/tutor/correction-pipeline";
import { TURN_SCHEMA } from "@/lib/tutor/turn-pipeline";

/**
 * The first request with a new strict schema carries extra latency (OpenAI docs; we measured an
 * 11.7 s outlier against 1.6 s steady state). Calling each schema once at startup moves that cost
 * off the first learner. Failures are harmless: it's only a warm-up.
 */
export async function warmUpSchemas(llm: LlmProvider): Promise<{ warmed: string[]; failed: string[] }> {
  const schemas = [TURN_SCHEMA, EDITS_SCHEMA, EXPLAIN_SCHEMA, VERIFY_SCHEMA, SUMMARY_SCHEMA];
  const results = await Promise.allSettled(
    schemas.map((schema) => llm.turn({ system: "Warm-up request. Return a minimal valid JSON object for the schema.", user: "warm-up", schema, effort: "none" })),
  );
  return {
    warmed: schemas.filter((_, i) => results[i].status === "fulfilled").map((s) => s.name),
    failed: schemas.filter((_, i) => results[i].status === "rejected").map((s) => s.name),
  };
}
