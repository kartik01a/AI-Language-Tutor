// Correction-pipeline evaluation on REAL speech recognition + REAL LLM (costs ≈ a few cents).
// Reports the headline "trustworthy corrections" numbers: false-correction rate and recall.
// Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/eval-corrections.mjs [dataset.json] [repeats]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { AzureTts } from "../lib/providers/azure-tts.ts";
import { DeepgramStt } from "../lib/providers/deepgram.ts";
import { OpenAiLlm } from "../lib/providers/openai.ts";
import { runCorrectionPipeline } from "../lib/tutor/correction-pipeline.ts";

const file = process.argv[2] ?? "eval/datasets/ja/corrections.v0.json";
const repeats = Number(process.argv[3] ?? 1);
const ds = JSON.parse(readFileSync(file, "utf8"));
const tts = new AzureTts({ key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION });
const stt = new DeepgramStt({ apiKey: process.env.DEEPGRAM_API_KEY });
const llm = new OpenAiLlm({ apiKey: process.env.OPENAI_API_KEY, hedgeAfterMs: 4000, timeoutMs: 20000 });

const rows = [];
for (const item of ds.items) {
  const clip = await tts.synthesize(item.text, { provider: "azure", voiceName: "ja-JP-KeitaNeural", locale: "ja-JP" });
  const asr = await stt.transcribe(clip.audio, "audio/mpeg", ["ja", "en"]);
  for (let r = 0; r < repeats; r++) {
    const out = await runCorrectionPipeline(llm, { words: asr.words, lang: "ja", level: ds.level, strictness: "balanced", effort: process.env.EFFORT || undefined, riskSpans: asr.words.flatMap((w, i) => (w.conf !== null && w.conf < 0.6 ? [[i, i + 1]] : [])) });
    const cards = out.cards.map((c) => ({ code: c.errorCode, original: c.original, corrected: c.corrected }));
    const hit = item.expect ? cards.some((c) => c.code === item.expect.code) : null;
    const wrongCards = cards.filter((c) => !item.expect || c.code !== item.expect.code);
    rows.push({ id: item.id, said: item.text, heard: asr.text, expect: item.expect?.code ?? null, cards, hit, wrongCards: wrongCards.length, dropped: out.dropped.map((d) => `${d.edit.code}:${d.reason}`) });
    console.log(`${item.id}  heard=${asr.text}  expect=${item.expect?.code ?? "no error"}  cards=${cards.map((c) => `${c.original}→${c.corrected}[${c.code}]`).join(" ; ") || "none"}${out.dropped.length ? `  dropped=${out.dropped.map((d) => d.reason).join(",")}` : ""}`);
  }
}
const err = rows.filter((r) => r.expect);
const ok = rows.filter((r) => !r.expect);
const recall = err.filter((r) => r.hit).length / err.length;
const fp = ok.filter((r) => r.cards.length > 0).length / ok.length;
const totalCards = rows.reduce((n, r) => n + r.cards.length, 0);
const goodCards = rows.reduce((n, r) => n + (r.expect ? r.cards.filter((c) => c.code === r.expect).length : 0), 0);
console.log(`\nRESULTS (${rows.length} runs; error items=${err.length}, valid items=${ok.length})`);
console.log(`  recall (expected error code shown as a card):  ${(recall * 100).toFixed(0)}%`);
console.log(`  false-correction rate on valid sentences:       ${(fp * 100).toFixed(0)}%   (gate: ≤ 5%)`);
console.log(`  card precision (cards matching expectation):    ${totalCards ? ((goodCards / totalCards) * 100).toFixed(0) : "n/a"}%   (gate: ≥ 90%)`);
mkdirSync("eval/reports", { recursive: true });
writeFileSync(`eval/reports/corrections-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ file, repeats, recall, falseCorrectionRate: fp, rows }, null, 1));
process.exit(0);
