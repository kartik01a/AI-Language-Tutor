// Spoken-correction check on the 20 seed sentences: does the live turn call fix real errors (recall) and leave valid
// sentences alone (false-recast rate)? Gate decisions use the same fastPathRecastAllowed as the app.
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/eval-recast.mjs
import { readFileSync } from "node:fs";
import { buildProviders } from "../lib/server/runtime.ts";
import { buildTurnPrompt } from "../lib/tutor/prompt.ts";
import { TURN_SCHEMA } from "../lib/tutor/turn-pipeline.ts";
import { turnOutputSchema } from "../lib/tutor/schemas.ts";
import { fastPathRecastAllowed } from "../lib/tutor/correction-pipeline.ts";
import { TUTORS } from "../lib/tutor/tutors.ts";

process.env.PROVIDERS = "real";
const { llm } = buildProviders();
const tutor = Object.values(TUTORS)[0];
const data = JSON.parse(readFileSync(new URL("../eval/datasets/ja/corrections.v0.json", import.meta.url), "utf8"));
let errs = 0, caught = 0, valid = 0, falseRecast = 0;
const extra = [{ id: 'x1', text: '私はおにぎりがおいしいです。', expect: { code: 'ja.phrasing.unnatural' } }, { id: 'x2', text: '私は日本語を勉強しています。' }, { id: 'x3', text: 'おにぎりはおいしいです。' }, { id: 'x4', text: '私はおにぎりが好きです。' }];
for (const it of [...data.items, ...extra]) {
  const text = it.text.replace(/[。、]/g, "");
  const words = [...text].map((w, i) => ({ w, conf: 0.96, start: i * 0.2, end: i * 0.2 + 0.18 }));
  const prompt = buildTurnPrompt({ tutor, level: "A2", strictness: "strict", learner: { firstName: "Priya", recurringMistakes: [] },
    session: { coachMode: "tutor", topic: "食べ物", goals: [], simplifyMode: false, wrapUp: false, history: [{ role: "tutor", text: "最近、何をしましたか？" }], currentQuestion: { text: "最近、何をしましたか？", expects: "open" } },
    asr: { text, lang: "ja", langConf: null, words }, gate: { rejected: null, reason: null, meanConf: 0.96, borderline: false, riskSpans: [], lowWords: [] }, allowedActions: [] });
  const r = await llm.turn({ ...prompt, schema: TURN_SCHEMA, effort: "none" });
  const out = turnOutputSchema.parse(r.json);
  const spoken = out.reply.recast && fastPathRecastAllowed(out.analysis.recast_candidate, { words, riskSpans: [], level: "A2", strictness: "strict" }) && out.reply.recast.replace(/[。、]/g, "") !== text;
  if (it.expect) { errs++; if (spoken) caught++; } else { valid++; if (spoken) falseRecast++; }
  console.log(`${it.expect ? "ERR  " : "OK   "} ${it.text.padEnd(22)} ${spoken ? "→ SPOKEN FIX: " + out.reply.recast : "(no spoken fix)"}`);
}
console.log(`\nspoken-fix recall ${caught}/${errs}   false spoken fixes on valid sentences ${falseRecast}/${valid}`);
process.exit(0);
