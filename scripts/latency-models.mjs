// Which OpenAI model answers a tutor turn fastest? Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/latency-models.mjs model1 model2 ...
import { buildTurnPrompt } from "../lib/tutor/prompt.ts";
import { turnOutputSchema } from "../lib/tutor/schemas.ts";
import { strictJsonSchema } from "../lib/providers/json-schema.ts";
import { TUTORS } from "../lib/tutor/tutors.ts";

const tutor = Object.values(TUTORS)[0];
const text = "昨日 友達 と 公園 で ラーメン を 食べ ました";
const asr = { text, lang: "ja", langConf: null, words: text.split(" ").map((w, i) => ({ w, conf: 0.95, start: i * 0.3, end: i * 0.3 + 0.25 })) };
const gate = { rejected: null, reason: null, meanConf: 0.95, borderline: false, riskSpans: [], lowWords: [] };
const prompt = buildTurnPrompt({ tutor, level: "A2", strictness: "balanced", learner: { firstName: "Priya", recurringMistakes: [] },
  session: { topic: "食べ物", goals: [], simplifyMode: false, wrapUp: false, history: [{ role: "tutor", text: "昨日は何を食べましたか？" }], currentQuestion: { text: "昨日は何を食べましたか？", expects: "open" } }, asr, gate, allowedActions: [] });
const lean = turnOutputSchema.omit({ hints: true, words_introduced: true });
const schema = strictJsonSchema(lean);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const model of process.argv.slice(2)) {
  const ms = []; let sample = "", tokens = 0, err = "";
  for (let i = 0; i < 4; i++) {
    for (const reasoning of [{ effort: "none" }, undefined]) {
      const t = performance.now();
      const res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], text: { format: { type: "json_schema", name: "t", strict: true, schema } }, ...(reasoning ? { reasoning } : {}), store: false }) });
      const j = await res.json();
      if (!res.ok) { err = j.error?.message?.slice(0, 80) ?? res.status; continue; }
      ms.push(Math.round(performance.now() - t)); tokens = j.usage?.output_tokens;
      sample = j.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text ?? "";
      break;
    }
  }
  const r = (() => { try { return JSON.parse(sample).reply.sentences.join(" / "); } catch { return sample.slice(0, 80); } })();
  console.log(`${model.padEnd(18)} ${ms.length ? "median " + med(ms) + " ms  " + JSON.stringify(ms) + " tok " + tokens : "ERR " + err}\n    ${r}`);
}
