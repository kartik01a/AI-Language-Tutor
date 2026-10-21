// Phase 0 probe: Deepgram on (a) Azure-synthesised speech (shape/accuracy sanity check — NOT a substitute
// for real learner audio), (b) silence, (c) tone. Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/probe-deepgram.mjs
import { readFileSync } from "node:fs";
import { DeepgramStt } from "../lib/providers/deepgram.ts";
import { makeToneWav } from "../lib/audio/tone.ts";

const dir = process.env.OUT ?? "/tmp/lactice-probe";
const dg = new DeepgramStt({ apiKey: process.env.DEEPGRAM_API_KEY });
const silence = (() => { const w = makeToneWav(440, 2000, 16000, 0); return w; })();
const cases = [
  { name: "ja (Azure Nanami)", file: `${dir}/ja_Nanami.mp3`, mime: "audio/mpeg", lang: "ja", expect: "こんにちは今日は何について話しましょうか" },
  { name: "ja slow", file: `${dir}/ja_Nanami_slow.mp3`, mime: "audio/mpeg", lang: "ja", expect: "こんにちは今日は何について話しましょうか" },
  { name: "de (Azure Katja)", file: `${dir}/de_Katja.mp3`, mime: "audio/mpeg", lang: "de", expect: "hallo worüber möchtest du heute sprechen" },
  { name: "en (Azure Jenny)", file: `${dir}/en_US_Jenny.mp3`, mime: "audio/mpeg", lang: "en", expect: "hi what would you like to talk about today" },
  { name: "silence 2s", bytes: silence, mime: "audio/wav", lang: "ja" },
  { name: "tone 1s", bytes: makeToneWav(440, 1000, 16000, 0.3), mime: "audio/wav", lang: "ja" },
];
for (const c of cases) {
  const bytes = c.bytes ?? new Uint8Array(readFileSync(c.file));
  const t0 = Date.now();
  try {
    const r = await dg.transcribe(bytes, c.mime, [c.lang, "en"]);
    const ms = Date.now() - t0;
    const confs = r.words.map((w) => w.conf).filter((x) => x !== null);
    const mean = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(3) : "n/a";
    const norm = (s) => s.toLowerCase().replace(/[\s、。！？!?,.]/g, "");
    console.log(`${c.name}: ${ms}ms  text=${JSON.stringify(r.text)}  words=${r.words.length} meanConf=${mean} lang=${r.lang}`);
    if (c.expect) console.log(`   exact match after normalising: ${norm(r.text) === norm(c.expect)}  minWordConf=${confs.length ? Math.min(...confs).toFixed(2) : "n/a"}`);
    if (c.name.startsWith("ja (")) console.log("   words:", r.words.map((w) => `${w.w}(${w.conf?.toFixed(2)})`).join(" "));
  } catch (e) { console.log(`${c.name}: FAILED ${String(e.message).slice(0, 200)}`); }
}
