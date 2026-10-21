"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Recorder, classifyMicError } from "@/lib/audio/recorder";
import { blobToWav16k } from "@/lib/audio/wav";

interface PromptItem { id: string; text: string; reading: string; romaji: string; en: string }
type Status = { kind: "idle" } | { kind: "recording" } | { kind: "review"; url: string; wav: Uint8Array; seconds: number } | { kind: "error"; message: string };

/** Dev-only: record the listed phrases in your own voice; saved locally for the speech-recognition bake-off. */
export function ClipRecorder({ prompts }: { prompts: PromptItem[] }) {
  const [speaker, setSpeaker] = useState("me");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const rec = useRef<Recorder | null>(null);
  const current = prompts[i];

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/dev/clips?speaker=${encodeURIComponent(speaker)}`).then((x) => x.json()).catch(() => ({ saved: [] }));
    setSaved(new Set(r.saved));
  }, [speaker]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const start = async () => {
    try {
      rec.current ??= new Recorder();
      await rec.current.open();
      rec.current.start();
      setStatus({ kind: "recording" });
    } catch (e) {
      setStatus({ kind: "error", message: `Microphone problem (${classifyMicError(e)}). Allow the mic and retry.` });
    }
  };
  const stop = async () => {
    const clip = await rec.current!.stop();
    try {
      const wav = await blobToWav16k(clip.blob);
      setStatus({ kind: "review", url: URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" })), wav, seconds: clip.durationMs / 1000 });
    } catch {
      setStatus({ kind: "error", message: "Could not process that recording. Try again." });
    }
  };
  const save = async () => {
    if (status.kind !== "review") return;
    const form = new FormData();
    form.append("audio", new Blob([status.wav as BlobPart], { type: "audio/wav" }), "clip.wav");
    form.append("speaker", speaker);
    form.append("promptId", current.id);
    const r = await fetch("/api/dev/clips", { method: "POST", body: form });
    if (!r.ok) return setStatus({ kind: "error", message: (await r.json().catch(() => ({}))).error ?? "Save failed" });
    setStatus({ kind: "idle" });
    await refresh();
    setI((n) => Math.min(prompts.length - 1, n + 1));
  };

  const btn = "rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40";
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6 text-neutral-900">
      <h1 className="text-xl font-bold">Record practice phrases</h1>
      <p className="text-sm text-neutral-600">
        Say each phrase the way you naturally would. Clips are saved only on this computer (git-ignored) so we can compare speech recognisers on your real voice.
      </p>
      <label className="text-sm">
        Your name (letters/numbers):{" "}
        <input value={speaker} onChange={(e) => setSpeaker(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24))} className="rounded border border-neutral-300 px-2 py-1" />
      </label>
      <p className="text-sm" data-testid="progress">{saved.size} of {prompts.length} saved</p>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <div className="text-xs text-neutral-500">Phrase {i + 1} of {prompts.length} {saved.has(current.id) && "✓ saved"}</div>
        <div lang="ja" className="mt-1 text-3xl">{current.text}</div>
        <div lang="ja" className="text-neutral-500">{current.reading}</div>
        <div className="mt-1 text-sm">{current.romaji} — <i>{current.en}</i></div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {status.kind !== "recording" ? (
            <button onClick={() => void start()} className={`${btn} bg-indigo-600 text-white`}>🎤 Record</button>
          ) : (
            <button onClick={() => void stop()} className={`${btn} bg-rose-500 text-white`}>■ Stop</button>
          )}
          {status.kind === "review" && (
            <>
              <audio src={status.url} controls className="h-9" />
              <button onClick={() => void save()} className={`${btn} bg-emerald-600 text-white`}>Save &amp; next</button>
            </>
          )}
        </div>
        {status.kind === "recording" && <p className="mt-2 text-sm text-rose-600">Recording… say the phrase, then press Stop.</p>}
        {status.kind === "error" && <p role="alert" className="mt-2 text-sm text-red-700">{status.message}</p>}
      </section>

      <div className="flex gap-2">
        <button onClick={() => { setI((n) => Math.max(0, n - 1)); setStatus({ kind: "idle" }); }} disabled={i === 0} className={`${btn} border border-neutral-300`}>← Back</button>
        <button onClick={() => { setI((n) => Math.min(prompts.length - 1, n + 1)); setStatus({ kind: "idle" }); }} disabled={i === prompts.length - 1} className={`${btn} border border-neutral-300`}>Skip →</button>
      </div>
    </main>
  );
}
