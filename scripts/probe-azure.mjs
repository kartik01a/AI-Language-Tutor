// Phase 0 probe: do Azure standard voices return viseme events for ja-JP / de-DE / en-US? (docs/17 R-07)
// Usage: node --env-file=.env.local --experimental-strip-types scripts/probe-azure.mjs
import { AzureTts } from "../lib/providers/azure-tts.ts";
import { writeFileSync, mkdirSync } from "node:fs";

const tts = new AzureTts({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION });
const cases = [
  { name: "ja Nanami", text: "こんにちは！今日は何について話しましょうか？", voice: { provider: "azure", voiceName: "ja-JP-NanamiNeural", locale: "ja-JP" } },
  { name: "ja Nanami slow", text: "こんにちは！今日は何について話しましょうか？", voice: { provider: "azure", voiceName: "ja-JP-NanamiNeural", locale: "ja-JP", rate: "-25%" } },
  { name: "de Katja", text: "Hallo! Worüber möchtest du heute sprechen?", voice: { provider: "azure", voiceName: "de-DE-KatjaNeural", locale: "de-DE" } },
  { name: "en-US Jenny", text: "Hi! What would you like to talk about today?", voice: { provider: "azure", voiceName: "en-US-JennyNeural", locale: "en-US" } },
];
const out = process.env.OUT ?? "/tmp/lactice-probe";
mkdirSync(out, { recursive: true });
for (const c of cases) {
  const t0 = Date.now();
  try {
    const r = await tts.synthesize(c.text, c.voice);
    const ms = Date.now() - t0;
    const shapes = [...new Set(r.visemes.map((v) => v.v))];
    console.log(`${c.name}: OK ${ms}ms  audio=${r.audio.length}B  duration=${Math.round(r.durationMs)}ms  visemes=${r.visemes.length} shapes=[${shapes.join(",")}]  billable=${r.billableChars}`);
    writeFileSync(`${out}/${c.name.replace(/\W+/g, "_")}.mp3`, r.audio);
  } catch (e) {
    console.log(`${c.name}: FAILED ${String(e.message).slice(0, 200)}`);
  }
}
process.exit(0);
