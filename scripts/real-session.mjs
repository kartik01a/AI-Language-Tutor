// Real end-to-end session through SessionService with Deepgram + OpenAI + Azure (costs a few cents).
// The "learner" is an Azure voice speaking scripted sentences — plumbing/behaviour test, NOT learner-audio evidence.
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/real-session.mjs
import { AzureTts } from "../lib/providers/azure-tts.ts";
import { buildProviders } from "../lib/server/runtime.ts";
import { loadConfig } from "../lib/config.ts";
import { MemorySpendStore, monthKey } from "../lib/limits/budget.ts";
import { MemorySessionStore } from "../lib/session/store.ts";
import { SessionService } from "../lib/session/service.ts";

process.env.PROVIDERS = "real";
const p = buildProviders();
const spend = new MemorySpendStore();
const svc = new SessionService({ store: new MemorySessionStore(), stt: p.stt, llm: p.llm, tts: p.tts, spend, config: loadConfig() });
const learnerVoice = new AzureTts({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION });
const say = async (text) => (await learnerVoice.synthesize(text, { provider: "azure", voiceName: "ja-JP-KeitaNeural", locale: "ja-JP" }));

async function collect(gen) {
  const events = []; let audio = 0;
  for await (const f of gen) {
    if (f.kind === "event") events.push(f.event);
    else audio++;
  }
  return { events, audio };
}
const sentences = (ev) => ev.filter((e) => e.t === "sentence").map((e) => e.text);
const cost = async () => spend.monthToDate(monthKey(new Date()));

const { sessionId } = await svc.createSession({ level: "A2", firstName: "Priya" });
await collect(svc.handleEvent(sessionId, { e: "start" }));
await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));

const script = [
  "私はラーメンが好きです。",
  "きのう、友達と公園を行きました。",
  "昨日、ラーメンを食べます。",
];
for (const line of script) {
  const clip = await say(line);
  const before = await cost();
  const t0 = Date.now();
  const { events } = await collect(svc.handleTurn(sessionId, clip.audio, "audio/mpeg", { speechMs: Math.round(clip.durationMs), clipMs: Math.round(clip.durationMs) }));
  const tr = events.find((e) => e.t === "transcript");
  const cat = events.find((e) => e.t === "category");
  const end = events.find((e) => e.t === "turn_end");
  const cards = events.find((e) => e.t === "corrections");
  console.log(`\nLEARNER (said): ${line}`);
  console.log(`  heard:      ${tr?.text ?? "(unclear)"}   [${cat?.category} → ${cat?.action}]`);
  console.log(`  Yuki:       ${sentences(events).join(" / ")}`);
  console.log(`  cards:      ${cards ? cards.cards.map((c) => `${c.original}→${c.corrected} (${c.errorCode}) "${c.explanation}"`).join(" ; ") : "none"}`);
  console.log(`  latency:    ${JSON.stringify(end?.latency)}  wall=${Date.now() - t0}ms  cost=$${((await cost()) - before).toFixed(5)}`);
  const err = events.find((e) => e.t === "error"); if (err) console.log("  ERROR:", err);
}
await collect(svc.handleEvent(sessionId, { e: "end" }));
const s = await svc.summarise(sessionId);
console.log("\nSUMMARY:", JSON.stringify({ fixes: s.fixes.map((f) => `${f.original}→${f.corrected}`), second: s.worthASecondLook.map((f) => f.errorCode), didWell: s.didWell, stats: s.stats, level: s.level.reason ?? s.level.after, next: s.nextFocus }, null, 1));
console.log(`\nTOTAL SESSION COST: $${(await cost()).toFixed(5)}`);
process.exit(0);
