// Latency lab: where do the seconds go? Costs a few cents. Learner audio is synthetic (Azure voice).
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/latency-lab.mjs [stt|llm|tts|all]
import { z } from "zod";
import { AzureTts } from "../lib/providers/azure-tts.ts";
import { buildProviders } from "../lib/server/runtime.ts";
import { buildTurnPrompt } from "../lib/tutor/prompt.ts";
import { turnOutputSchema } from "../lib/tutor/schemas.ts";
import { strictJsonSchema } from "../lib/providers/json-schema.ts";
import { TUTORS } from "../lib/tutor/tutors.ts";
import { DeepgramStt } from "../lib/providers/deepgram.ts";

process.env.PROVIDERS = "real";
const which = process.argv[2] ?? "all";
const p = buildProviders();
const N = 5;
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const row = (name, ms, extra = "") => console.log(`${name.padEnd(34)} median ${String(med(ms)).padStart(5)} ms   all: ${ms.join(", ")} ${extra}`);
async function time(fn, n = N) { const out = []; let last; for (let i = 0; i < n; i++) { const t = performance.now(); last = await fn(); out.push(Math.round(performance.now() - t)); } return { ms: out, last }; }

const voice = new AzureTts({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION });
const clip = await voice.synthesize("昨日、友達と公園でラーメンを食べました。", { provider: "azure", voiceName: "ja-JP-KeitaNeural", locale: "ja-JP" });
console.log(`clip: ${clip.audio.length} bytes ${clip.format ?? ""}\n`);
const mime = clip.format === "wav16k" ? "audio/wav" : "audio/mpeg";

if (which === "all" || which === "stt") {
  console.log("== STT (Deepgram) ==");
  for (const [name, o] of [["nova-3 ja", {}], ["nova-3 multi", { multi: true }], ["nova-2 ja", { model: "nova-2" }]]) {
    const stt = new DeepgramStt({ apiKey: process.env.DEEPGRAM_API_KEY, ...o });
    await stt.transcribe(clip.audio, mime, ["ja"]); // warm connection
    const r = await time(() => stt.transcribe(clip.audio, mime, ["ja"]));
    row(name, r.ms, `→ ${r.last.text}`);
  }
}

if (which === "all" || which === "llm") {
  console.log("\n== LLM turn call ==");
  const tutor = TUTORS.yuki ?? Object.values(TUTORS)[0];
  const asr = { text: "昨日 友達 と 公園 で ラーメン を 食べ ました", lang: "ja", langConf: null, words: "昨日 友達 と 公園 で ラーメン を 食べ ました".split(" ").map((w, i) => ({ w, conf: 0.95, start: i * 0.3, end: i * 0.3 + 0.25 })) };
  const gate = { rejected: null, reason: null, meanConf: 0.95, borderline: false, riskSpans: [], lowWords: [] };
  const prompt = buildTurnPrompt({
    tutor, level: "A2", strictness: "balanced", learner: { firstName: "Priya", recurringMistakes: [] },
    session: { topic: "食べ物", goals: [], simplifyMode: false, wrapUp: false, history: [{ role: "tutor", text: "昨日は何を食べましたか？" }], currentQuestion: { text: "昨日は何を食べましたか？", expects: "open" } },
    asr, gate, allowedActions: [],
  });
  const variants = {
    "full schema (today)": turnOutputSchema,
    "no hints/words_introduced": turnOutputSchema.omit({ hints: true, words_introduced: true }),
    "lean: analysis+reply only": z.object({ analysis: turnOutputSchema.shape.analysis.pick({ category: true, topic: true, off_topic_reason: true, meta: true, recast_candidate: true, recovered_fragment: true, meaning_summary: true, goal_progress: true }), reply: turnOutputSchema.shape.reply }),
  };
  for (const [name, schema] of Object.entries(variants)) {
    let tokens = [];
    const r = await time(async () => { const x = await p.llm.turn({ ...prompt, schema: { name: "t", jsonSchema: strictJsonSchema(schema) }, effort: "none" }); tokens.push(x.usage.outputTokens); return x; });
    row(name, r.ms, `out tokens: ${tokens.join(",")}`);
  }
}

if (which === "all" || which === "tts") {
  console.log("\n== TTS (Azure, one sentence) ==");
  const line = "そうなんですね！昨日はラーメンを食べたんですね。";
  await voice.synthesize(line, { provider: "azure", voiceName: "ja-JP-NanamiNeural", locale: "ja-JP" });
  const r = await time(() => voice.synthesize(line, { provider: "azure", voiceName: "ja-JP-NanamiNeural", locale: "ja-JP" }));
  row("one sentence, mp3 + visemes", r.ms);
}
