import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import prompts from "@/eval/prompts/ja.json";
import { readWavInfo } from "@/lib/audio/wav";

// DEV ONLY: saves recorded clips to eval/audio/<speaker>/<promptId>.wav for the speech-recognition
// bake-off. Voice recordings are personal data: this route is disabled in production, writes only
// to a git-ignored folder, and accepts only known prompt ids and a strictly validated speaker name.

const ROOT = path.join(process.cwd(), "eval", "audio");
const SPEAKER = /^[a-z0-9_-]{1,24}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const ids = new Set(prompts.prompts.map((p) => p.id));

const notFound = () => new Response("Not found", { status: 404 });

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return notFound();
  const form = await req.formData().catch(() => null);
  const speaker = String(form?.get("speaker") ?? "");
  const promptId = String(form?.get("promptId") ?? "");
  const file = form?.get("audio");
  if (!form || !(file instanceof Blob)) return Response.json({ error: "Missing audio" }, { status: 400 });
  if (!SPEAKER.test(speaker)) return Response.json({ error: "Speaker must be 1-24 chars of a-z, 0-9, _ or -" }, { status: 400 });
  if (!ids.has(promptId)) return Response.json({ error: "Unknown prompt" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Clip too large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readWavInfo(bytes);
  if (!info || info.sampleRate !== 16000 || info.channels !== 1 || info.bitsPerSample !== 16) {
    return Response.json({ error: "Expected 16 kHz mono 16-bit WAV" }, { status: 415 });
  }
  const dir = path.join(ROOT, speaker);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${promptId}.wav`), bytes);
  return Response.json({ ok: true, seconds: Number((info.samples / info.sampleRate).toFixed(2)) });
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return notFound();
  const speaker = new URL(req.url).searchParams.get("speaker") ?? "";
  if (!SPEAKER.test(speaker)) return Response.json({ saved: [] });
  const files = await readdir(path.join(ROOT, speaker)).catch(() => [] as string[]);
  return Response.json({ saved: files.filter((f) => f.endsWith(".wav")).map((f) => f.replace(/\.wav$/, "")) });
}
