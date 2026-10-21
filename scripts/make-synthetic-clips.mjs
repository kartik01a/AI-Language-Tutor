// Dry-run data for the STT bake-off: the prompt phrases spoken by Azure voices, as 16 kHz WAV, in
// eval/audio/<speaker>/. NOT a substitute for real learner audio (clean synthetic speech is easy).
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/make-synthetic-clips.mjs [speaker] [voice]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { AzureTts } from "../lib/providers/azure-tts.ts";

const speaker = process.argv[2] ?? "synth";
const voice = process.argv[3] ?? "ja-JP-KeitaNeural";
const tts = new AzureTts({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION, format: "wav16k" });
const { prompts } = JSON.parse(readFileSync("eval/prompts/ja.json", "utf8"));
mkdirSync(`eval/audio/${speaker}`, { recursive: true });
for (const p of prompts) {
  const r = await tts.synthesize(p.text, { provider: "azure", voiceName: voice, locale: "ja-JP" });
  writeFileSync(`eval/audio/${speaker}/${p.id}.wav`, r.audio);
}
console.log(`wrote ${prompts.length} clips to eval/audio/${speaker} using ${voice}`);
process.exit(0);
