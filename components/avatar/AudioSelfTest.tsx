"use client";

import { useCallback, useEffect, useState } from "react";
import { Recorder, classifyMicError } from "@/lib/audio/recorder";
import { Player, type QueuedClip } from "@/lib/audio/player";
import { makeToneWav } from "@/lib/audio/tone";

type Report = Record<string, unknown>;

/** Dev-only: exercises the real Recorder + Player in this browser and prints a JSON report. */
export function AudioSelfTest({ auto }: { auto: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    const out: Report = { userAgent: navigator.userAgent };
    try {
      const rec = new Recorder();
      await rec.open();
      rec.start();
      await new Promise((r) => setTimeout(r, 1500));
      const clip = await rec.stop();
      rec.close();
      out.recording = {
        mime: clip.mime, ext: clip.ext, bytes: clip.blob.size, durationMs: Math.round(clip.durationMs),
        vad: { speechMs: clip.vad.speechMs, clipMs: Math.round(clip.vad.clipMs), rmsDb: Number(clip.vad.rmsDb.toFixed(1)), tooQuiet: clip.vad.tooQuiet, hasTrim: clip.vad.trim !== null },
      };
    } catch (e) {
      out.recordingError = classifyMicError(e) + ": " + String((e as Error)?.message ?? e);
    }

    try {
      const player = new Player();
      await player.unlock();
      player.beginMessage();
      const ended = new Promise<string>((resolve) => {
        player.onAllEnded = () => resolve("ended");
        setTimeout(() => resolve("timeout"), 4000);
      });
      const clips: QueuedClip[] = [];
      for (const [f, ms] of [[330, 400], [440, 500], [550, 300]] as const) {
        clips.push(await player.enqueue(makeToneWav(f, ms).buffer as ArrayBuffer));
      }
      out.playback = {
        state: player.ctx.state,
        sampleRate: player.ctx.sampleRate,
        outputLatencySec: (player.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? null,
        gaps: clips.slice(1).map((c, i) => Number((c.startAt - clips[i].endAt).toFixed(4))),
        durationsSec: clips.map((c) => Number(c.buffer.duration.toFixed(3))),
        finished: await ended,
      };
      player.replay();
      out.replayQueued = player.queued.length;
      player.stopAll();
      out.afterStop = player.queued.length;
    } catch (e) {
      out.playbackError = String((e as Error)?.message ?? e);
    }
    out.done = true;
    setReport(out);
    setBusy(false);
  }, []);

  // ?auto=1 runs once on load (used for headless verification). The timeout also keeps
  // StrictMode's double-mount from starting two runs.
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => void run(), 0);
    return () => clearTimeout(id);
  }, [auto, run]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6 text-neutral-900">
      <h1 className="text-xl font-bold">Audio self-test</h1>
      <p className="text-sm text-neutral-600">Records 1.5 s from the mic, then plays three tone clips back-to-back.</p>
      <button
        disabled={busy}
        onClick={run}
        className="w-fit rounded-full bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Running…" : "Run self-test"}
      </button>
      <pre id="result" className="overflow-auto rounded-lg bg-neutral-100 p-3 text-xs">
        {report ? JSON.stringify(report, null, 2) : "(no result yet)"}
      </pre>
    </main>
  );
}
