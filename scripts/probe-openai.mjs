// Phase 0 probe: does gpt-6-luna work with strict schemas, effort "none", and what do latency/caching look like?
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/probe-openai.mjs
import { OpenAiLlm } from "../lib/providers/openai.ts";
import { strictJsonSchema } from "../lib/providers/json-schema.ts";
import { turnOutputSchema } from "../lib/tutor/schemas.ts";
import { buildStaticPrefix } from "../lib/tutor/prompt.ts";
import { yuki } from "../lib/tutor/tutors.ts";

const model = process.env.OPENAI_MODEL_TURN ?? "gpt-6-luna";
const llm = new OpenAiLlm({ apiKey: process.env.OPENAI_API_KEY, model });
const schema = { name: "turn_output", jsonSchema: strictJsonSchema(turnOutputSchema) };
const system = buildStaticPrefix(yuki, "A2");
const user = [
  "Learner: Priya | level A2 | correction strictness balanced", "Recurring mistakes: none yet", "Topic: 食べ物", "",
  "Conversation so far:", "Yuki: 好きな食べ物は何ですか？", "",
  "Learner transcript (word(confidence)): わたし(0.97) は(0.98) ラーメン(0.96) が(0.95) すき(0.94) です(0.97)",
  "Recogniser: mean confidence 0.96; low-confidence word positions: none",
].join("\n");

console.log(`model=${model}  static prefix ≈ ${Math.round(system.length / 3)} tokens (chars/3 estimate)`);
for (const effort of ["none", "none", "low"]) {
  const t0 = Date.now();
  try {
    const r = await llm.turn({ system, user, schema, effort });
    const parsed = turnOutputSchema.safeParse(r.json);
    console.log(`effort=${effort}: ${Date.now() - t0}ms  usage=${JSON.stringify(r.usage)}  validAgainstZod=${parsed.success}`);
    if (parsed.success && effort === "none") console.log("   category:", parsed.data.analysis.category, "| reply:", parsed.data.reply.sentences.join(" "));
    if (!parsed.success) console.log("   zod issues:", JSON.stringify(parsed.error.issues.slice(0, 3)));
  } catch (e) { console.log(`effort=${effort}: FAILED ${String(e.message).slice(0, 300)}`); }
}
