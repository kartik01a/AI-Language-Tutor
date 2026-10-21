// Speech-recognition bake-off on YOUR recordings (eval/audio/<speaker>/*.wav, made at /dev/record).
// Compares Deepgram (ja / multi), Azure ja-JP and OpenAI gpt-transcribe on accuracy (CER on kana),
// confidence, how often our gates would accept / ask "Did you say…?" / reject, and latency.
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/eval-stt.mjs <speaker>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { DeepgramStt } from "../lib/providers/deepgram.ts";
import { AzureStt } from "../lib/providers/azure-stt.ts";
import { OpenAiStt } from "../lib/providers/openai-stt.ts";
import { applyGates } from "../lib/tutor/gates.ts";
import { cer } from "../lib/eval/cer.ts";

const speaker = process.argv[2];
if (!speaker) { console.error("usage: eval-stt.mjs <speaker>"); process.exit(1); }
const dir = `eval/audio/${speaker}`;
const { prompts } = JSON.parse(readFileSync("eval/prompts/ja.json", "utf8"));
const byId = new Map(prompts.map((p) => [p.id, p]));
const clips = readdirSync(dir).filter((f) => f.endsWith(".wav")).map((f) => f.replace(".wav", "")).filter((id) => byId.has(id)).sort();
if (clips.length === 0) { console.error(`no clips in ${dir}`); process.exit(1); }

const K = new (Kuroshiro.default ?? Kuroshiro)();
await K.init(new (KuromojiAnalyzer.default ?? KuromojiAnalyzer)());
const toKana = async (t) => (t ? K.convert(t, { to: "hiragana" }) : "");

const providers = [
  { name: "Deepgram nova-3 (ja)", stt: new DeepgramStt({ apiKey: process.env.DEEPGRAM_API_KEY }) },
  { name: "Deepgram nova-3 (multi)", stt: new DeepgramStt({ apiKey: process.env.DEEPGRAM_API_KEY, multi: true }) },
  { name: "Azure STT ja-JP", stt: new AzureStt({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION }) },
  { name: "OpenAI gpt-transcribe", stt: new OpenAiStt({ apiKey: process.env.OPENAI_API_KEY }) },
];
const results = Object.fromEntries(providers.map((p) => [p.name, []]));
for (const id of clips) {
  const audio = new Uint8Array(readFileSync(`${dir}/${id}.wav`));
  const ref = byId.get(id);
  for (const p of providers) {
    const t0 = Date.now();
    try {
      const asr = await p.stt.transcribe(audio, "audio/wav", ["ja", "en"]);
      const ms = Date.now() - t0;
      const hyp = await toKana(asr.text);
      const known = asr.words.filter((w) => w.conf !== null).map((w) => w.conf);
      const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
      const gate = applyGates({ speechMs: 2000, clipMs: 3000 }, asr, { minSpeechMs: 400, allowedLangs: ["ja", "en", "hi"] });
      results[p.name].push({ id, text: asr.text, cer: cer(ref.reading, hyp), mean, gate: mean === null ? "no-confidence" : gate.rejected ?? "accept", ms });
    } catch (e) {
      results[p.name].push({ id, text: "", cer: 1, mean: null, gate: "ERROR", ms: Date.now() - t0, error: String(e.message).slice(0, 80) });
    }
  }
  console.log(`${id} ${ref.text}`);
  for (const p of providers) { const r = results[p.name].at(-1); console.log(`   ${p.name.padEnd(26)} ${r.text.padEnd(26)} CER ${r.cer.toFixed(2)}  conf ${r.mean === null ? " n/a" : r.mean.toFixed(2)}  ${r.gate}${r.error ? "  " + r.error : ""}`); }
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log(`\n=== ${speaker}: ${clips.length} clips ===`);
console.log("provider".padEnd(26), "meanCER", "exact", "accept", "confirm", "reject", "no-conf", "err", "p50 ms");
const summary = {};
for (const p of providers) {
  const r = results[p.name];
  const n = r.length, c = (g) => r.filter((x) => x.gate === g).length;
  summary[p.name] = { meanCER: r.reduce((a, x) => a + x.cer, 0) / n, exact: r.filter((x) => x.cer === 0).length / n, accept: c("accept") / n, confirm: c("CONFIRM_HEARD") / n, reject: (c("UNCLEAR_AUDIO") + c("NO_SPEECH")) / n, noConf: c("no-confidence") / n, errors: c("ERROR"), p50: median(r.map((x) => x.ms)) };
  const s = summary[p.name];
  console.log(p.name.padEnd(26), s.meanCER.toFixed(2).padStart(7), `${(s.exact * 100).toFixed(0)}%`.padStart(5), `${(s.accept * 100).toFixed(0)}%`.padStart(6), `${(s.confirm * 100).toFixed(0)}%`.padStart(7), `${(s.reject * 100).toFixed(0)}%`.padStart(6), `${(s.noConf * 100).toFixed(0)}%`.padStart(7), String(s.errors).padStart(3), String(s.p50).padStart(6));
}
mkdirSync("eval/reports", { recursive: true });
writeFileSync(`eval/reports/stt-${speaker}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ speaker, clips, summary, results }, null, 1));
process.exit(0);
