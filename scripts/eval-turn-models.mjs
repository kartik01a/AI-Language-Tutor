// Do faster models classify and answer tutor turns as well as the current one? Prints category + reply per scenario.
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/eval-turn-models.mjs model1 model2 ...
import { buildTurnPrompt } from "../lib/tutor/prompt.ts";
import { turnOutputSchema } from "../lib/tutor/schemas.ts";
import { strictJsonSchema } from "../lib/providers/json-schema.ts";
import { TUTORS } from "../lib/tutor/tutors.ts";
import { validateReply } from "../lib/tutor/output-validation.ts";

const tutor = Object.values(TUTORS)[0];
const schema = strictJsonSchema(turnOutputSchema.omit({ hints: true, words_introduced: true }));
const S = (text, q, expect, { conf = 0.93, topic = "食べ物", confirmed = false } = {}) => ({ text, q, expect, conf, topic, confirmed });
const scenarios = process.env.COACH ? [
  S("焼き おにぎり 飲み ます", { text: "何を食べましたか？", expects: "open" }, ["understood"]),
  S("おにぎり 飲み ます", { text: "好きな食べ物は何ですか？", expects: "open" }, ["understood"]),
  S("私 は 水 を 食べ ます", { text: "何を飲みますか？", expects: "open" }, ["understood"]),
  S("昨日 友達 と 公園 を 行き ました", { text: "昨日は何をしましたか？", expects: "open" }, ["understood"]),
  S("昨日 ラーメン", { text: "昨日は何を食べましたか？", expects: "open" }, ["understood"]),
  S("週末 映画 を 見 ます とても 楽しい でした", { text: "週末は何をしましたか？", expects: "open" }, ["understood"]),
  S("私 は 学生 です", { text: "お仕事は何ですか？", expects: "open" }, ["understood"]),
  S("ラーメン です", { text: "好きな食べ物は何ですか？", expects: "open" }, ["understood"]),
  S("東京 に 住み ます 去年 から", { text: "どこに住んでいますか？", expects: "open" }, ["understood"]),
] : [
  S("こんにちは カルテック です", { text: "お名前は何ですか？", expects: "open" }, ["understood"], { topic: null }),
  S("食べ物 が 好き です", { text: "何について話したいですか？", expects: "topic" }, ["understood"], { topic: null }),
  S("私 は ラーメン が 好き です", { text: "好きな食べ物は何ですか？", expects: "open" }, ["understood"]),
  S("昨日 ラーメン を 食べ ます", { text: "昨日は何を食べましたか？", expects: "open" }, ["understood"]),
  S("もう いち ど お願い します", { text: "好きな食べ物は何ですか？", expects: "open" }, ["meta_request"]),
  S("ゆっくり 話し て ください", { text: "週末は何をしましたか？", expects: "open" }, ["meta_request"]),
  S("わかり ません", { text: "どこに行きたいですか？", expects: "open" }, ["dont_know", "not_understood"]),
  S("how do you say delicious", { text: "ラーメンはどうでしたか？", expects: "open" }, ["native_language_help"], { conf: 0.9 }),
  S("天気 は どう です か", { text: "好きな食べ物は何ですか？", expects: "open" }, ["off_topic", "understood"]),
  S("え と あ の", { text: "好きな食べ物は何ですか？", expects: "open" }, ["partially_understood", "not_understood"], { conf: 0.5 }),
  S("はい", { text: "ラーメンが好きですか？", expects: "closed" }, ["understood"]),
  S("私 の 趣味 は 映画 を 見る こと です", { text: "趣味は何ですか？", expects: "open" }, ["understood"], { topic: "趣味" }),
];
for (const model of process.argv.slice(2)) {
  console.log(`\n=== ${model} ===`);
  let ok = 0, valid = 0, ms = [];
  for (const sc of scenarios) {
    const words = sc.text.split(" ").map((w, i) => ({ w, conf: sc.conf, start: i * 0.3, end: i * 0.3 + 0.25 }));
    const asr = { text: sc.text, lang: "ja", langConf: null, words };
    const gate = { rejected: null, reason: null, meanConf: sc.conf, borderline: sc.conf < 0.7, riskSpans: sc.conf < 0.7 ? [[0, words.length]] : [], lowWords: [] };
    const prompt = buildTurnPrompt({ tutor, level: "A2", strictness: "balanced", learner: { firstName: "Karthik", recurringMistakes: [] },
      session: { topic: sc.topic, goals: [], simplifyMode: false, wrapUp: false, history: [{ role: "tutor", text: sc.q.text }], currentQuestion: sc.q }, asr, gate, allowedActions: [], confirmed: sc.confirmed });
    const t = performance.now();
    const call = (reasoning) => fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], text: { format: { type: "json_schema", name: "t", strict: true, schema } }, ...(reasoning ? { reasoning: { effort: "none" } } : {}), store: false }) });
    let res = await call(true);
    if (!res.ok) res = await call(false); // non-reasoning models reject the reasoning parameter
    const j = await res.json();
    ms.push(Math.round(performance.now() - t));
    if (!res.ok) { console.log("ERR", j.error?.message); continue; }
    const out = JSON.parse(j.output.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text").text);
    const cat = out.analysis.category;
    const pass = sc.expect.includes(cat); if (pass) ok++;
    const v = validateReply(out.reply.sentences, { lang: "ja", level: "A2" }); if (v.ok) valid++;
    if (process.env.COACH) console.log("    recast:", JSON.stringify(out.reply.recast), "candidate:", JSON.stringify(out.analysis.recast_candidate));
    console.log(`${pass ? "ok  " : "DIFF"} ${sc.text.padEnd(22)} → ${cat.padEnd(20)} topic=${JSON.stringify(out.analysis.topic)} ${v.ok ? "" : "[invalid reply: " + v.issues.join(",") + "] "}\n       ${out.reply.sentences.join(" / ")}`);
  }
  console.log(`category ok ${ok}/${scenarios.length}, replies valid ${valid}/${scenarios.length}, median ${[...ms].sort((a, b) => a - b)[Math.floor(ms.length / 2)]} ms`);
}
