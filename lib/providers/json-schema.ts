import { z } from "zod";

// OpenAI strict structured outputs accept only a subset of JSON Schema. We send a stripped
// schema and still validate every response locally with the full Zod schema.

const UNSUPPORTED = new Set([
  "$schema", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum",
  "exclusiveMinimum", "exclusiveMaximum", "pattern", "format", "default", "multipleOf",
]);

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) if (!UNSUPPORTED.has(k)) out[k] = strip(v);
    return out;
  }
  return node;
}

export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return strip(z.toJSONSchema(schema, { io: "output" })) as Record<string, unknown>;
}
