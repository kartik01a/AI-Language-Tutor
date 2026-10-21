import { z } from "zod";
import { strictJsonSchema } from "@/lib/providers/json-schema";
import type { LlmProvider, LlmUsage } from "@/lib/providers/types";

// Every tutor line gets an English line under it (owner request). It is produced by a separate small
// request that runs while the voice is already playing, so it never delays the reply.

const translationsSchema = z.object({ items: z.array(z.string()) });
export const TRANSLATE_SCHEMA = { name: "translations", jsonSchema: strictJsonSchema(translationsSchema) };

export async function translateLines(
  llm: LlmProvider,
  lines: string[],
  to: "English" | "Hindi" = "English",
): Promise<{ items: string[]; usage: LlmUsage } | null> {
  if (lines.length === 0) return null;
  try {
    const r = await llm.turn({
      system: `TRANSLATE. Translate each numbered line spoken by a language tutor into natural, simple ${to} that a beginner would understand. Never guess or replace names or unfamiliar words with real-world ones (e.g. a person's name must NOT become a company or place): write them in romaji instead, such as Karutekku. Return JSON {"items":[...]} with EXACTLY one translation per line, in the same order.`,
      user: lines.map((l, i) => `${i + 1}. ${l}`).join("\n"),
      schema: TRANSLATE_SCHEMA,
      effort: "none",
    });
    const parsed = translationsSchema.safeParse(r.json);
    // A count mismatch means we can't tell which translation belongs to which line: show none rather than guess.
    if (!parsed.success || parsed.data.items.length !== lines.length || parsed.data.items.some((t) => t.trim() === "")) return null;
    return { items: parsed.data.items.map((t) => t.trim()), usage: r.usage };
  } catch {
    return null;
  }
}
