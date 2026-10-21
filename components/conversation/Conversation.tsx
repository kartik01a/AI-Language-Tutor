"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { AvatarStage, type AvatarStageHandle } from "@/components/avatar/AvatarStage";
import { Player } from "@/lib/audio/player";
import { Recorder, classifyMicError } from "@/lib/audio/recorder";
import type { ServerEvent } from "@/lib/contracts/events";
import { readFrames } from "./stream";
import { initialUi, reducer, STATUS_LABEL } from "./reducer";
import { CorrectionCards } from "./CorrectionCards";
import { SummaryPanel } from "./SummaryPanel";

export interface ConversationProps {
  svg: string;
  tutorName: string;
  level: "A1" | "A2" | "B1" | "B2";
  hintPulseSeconds: number;
  nudgeSeconds: number;
  maxRecordingSeconds: number;
}

const MIC_HELP: Record<string, string> = {
  denied: "Microphone access is blocked. Allow it in your browser's site settings, then reload.",
  no_device: "We can't find a microphone. Check it's connected and not used by another app.",
  in_use: "The microphone is busy in another app. Close it and try again.",
  unsupported: "This browser can't record voice. Please use Chrome or Safari.",
  unknown: "We couldn't start the microphone.",
};

export function Conversation(p: ConversationProps) {
  const [ui, dispatch] = useReducer(reducer, initialUi);
  const stage = useRef<AvatarStageHandle>(null);
  const player = useRef<Player | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const sessionId = useRef<string | null>(null);
  const pendingSentence = useRef<Extract<ServerEvent, { t: "sentence" }> | null>(null);
  const turnEnded = useRef(true);
  const endAfterAudio = useRef<string | null>(null);
  const hasAudio = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);
  const phaseRef = useRef(ui.phase);
  /** Each streamed response gets a run id; interrupted runs are muted so late frames are dropped. */
  const runCounter = useRef(0);
  const muted = useRef(new Set<number>());
  const [pulse, setPulse] = useReducer((_: boolean, v: boolean) => v, false);

  useEffect(() => {
    phaseRef.current = ui.phase;
  }, [ui.phase]);

  const ctl = () => stage.current?.controller;

  // After a turn: go back to "waiting" once the tutor has finished speaking.
  const settle = useCallback(() => {
    // Never override what the learner is doing (recording) or a terminal state. A stale
    // "audio ended" from an earlier message is ignored because turnEnded is cleared the
    // moment a new turn starts processing.
    if (["recording", "ended", "error", "intro", "starting"].includes(phaseRef.current)) return;
    if (!turnEnded.current) return;
    if (player.current?.isPlaying) return;
    ctl()?.stopSpeaking();
    if (endAfterAudio.current) {
      ctl()?.setState("celebrating");
      dispatch({ type: "ended", reason: endAfterAudio.current });
      return;
    }
    ctl()?.setState("listening");
    dispatch({ type: "phase", phase: "waiting" });
  }, []);

  const handleEvent = useCallback(
    async (e: ServerEvent, run: number) => {
      const isMuted = muted.current.has(run);
      switch (e.t) {
        case "transcript":
          dispatch({
            type: "message",
            message: { id: e.turnId, role: "learner", text: e.display === "unclear" ? "(I couldn't catch this)" : (e.text ?? ""), unclear: e.display === "unclear" },
          });
          dispatch({ type: "topic_chosen" });
          break;
        case "category":
          if (e.category === "UNCLEAR_AUDIO" || e.category === "NO_SPEECH" || e.category === "AMBIGUOUS") ctl()?.setExpression("confused");
          else ctl()?.setExpression(null);
          break;
        case "sentence":
          pendingSentence.current = isMuted ? null : e;
          break;
        case "corrections":
          dispatch({ type: "cards", turnId: e.turnId, cards: e.cards });
          break;
        case "hint":
          dispatch({ type: "hint", hint: { level: e.level, text: e.text, translation: e.translation } });
          break;
        case "limits":
          dispatch({ type: "limits", wrapUp: e.wrapUp });
          break;
        case "turn_end":
          if (!isMuted) {
            turnEnded.current = true;
            settle();
          }
          break;
        case "session_end":
          endAfterAudio.current = e.reason;
          break;
        case "error":
          dispatch({ type: "error", message: e.message, fatal: !e.retryable });
          break;
      }
    },
    [settle],
  );

  const handleAudio = useCallback(async (bytes: Uint8Array, run: number) => {
    const s = pendingSentence.current;
    const pl = player.current;
    if (!s || !pl || muted.current.has(run)) return;
    pendingSentence.current = null;
    const clip = await pl.enqueue(bytes.slice().buffer as ArrayBuffer);
    const c = ctl();
    if (!hasAudio.current) {
      hasAudio.current = true;
      c?.setExpression(null);
      c?.startMessage(() => pl.messageClockMs());
      dispatch({ type: "phase", phase: "tutor" });
    }
    c?.appendVisemes(s.visemes, pl.clipOffsetMs(clip));
    dispatch({ type: "message", message: { id: `${s.messageId}-${s.index}`, role: "tutor", text: s.text, translation: s.translation } });
  }, []);

  const run = useCallback(
    async (res: Response) => {
      const myRun = ++runCounter.current;
      turnEnded.current = false;
      hasAudio.current = false;
      if (!res.ok && !res.headers.get("content-type")?.includes("octet-stream")) {
        const j = await res.json().catch(() => null);
        dispatch({ type: "error", message: j?.error?.message ?? "Request failed", fatal: true });
        return;
      }
      try {
        await readFrames(res, { event: (e) => handleEvent(e, myRun), audio: (b) => handleAudio(b, myRun) });
      } catch {
        dispatch({ type: "error", message: "Connection lost. Please reload to continue.", fatal: true });
      }
      if (player.current) player.current.onAllEnded = settle;
    },
    [handleEvent, handleAudio, settle],
  );

  const post = useCallback(
    (body: unknown) =>
      fetch(`/api/sessions/${sessionId.current}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(run),
    [run],
  );

  /** Lightweight requests (hint, report) only apply their own events; they must not touch turn state. */
  const postQuiet = useCallback(async (body: unknown) => {
    const res = await fetch(`/api/sessions/${sessionId.current}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await readFrames(res, {
      event: (e) => {
        if (e.t === "hint") dispatch({ type: "hint", hint: { level: e.level, text: e.text, translation: e.translation } });
        else if (e.t === "error") dispatch({ type: "error", message: e.message, fatal: !e.retryable });
      },
      audio: () => {},
    }).catch(() => {});
  }, []);

  // ---- start (must run inside the user's tap so audio and mic unlock) ----
  const begin = async () => {
    dispatch({ type: "phase", phase: "starting" });
    try {
      const pl = new Player();
      await pl.unlock();
      pl.onAllEnded = settle;
      player.current = pl;
      const rec = new Recorder();
      await rec.open();
      recorder.current = rec;
    } catch (e) {
      dispatch({ type: "error", message: MIC_HELP[classifyMicError(e)], fatal: true });
      return;
    }
    const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: p.level }) });
    const j = await res.json();
    if (!res.ok) {
      dispatch({ type: "error", message: j.error?.message ?? "Could not start", fatal: true });
      return;
    }
    sessionId.current = j.sessionId;
    dispatch({ type: "session", id: j.sessionId });
    dispatch({ type: "chips", chips: j.chips });
    await post({ e: "start" });
  };

  // ---- microphone: tap to talk, tap to send; pressing it while the tutor speaks interrupts ----
  const interrupt = useCallback(() => {
    muted.current.add(runCounter.current); // drop the rest of the tutor's stream (D-25)
    pendingSentence.current = null;
    player.current?.stopAll();
    ctl()?.stopSpeaking();
    ctl()?.setState("listening");
  }, []);

  const toggleMic = useCallback(async () => {
    const phase = phaseRef.current;
    const rec = recorder.current;
    if (!rec || !sessionId.current) return;
    if (phase === "tutor" || phase === "waiting") {
      if (phase === "tutor") interrupt();
      await player.current?.unlock();
      rec.start();
      dispatch({ type: "phase", phase: "recording" });
      ctl()?.setState("listening");
      return;
    }
    if (phase === "recording") {
      turnEnded.current = false;
      dispatch({ type: "phase", phase: "processing" });
      ctl()?.setState("thinking");
      const clip = await rec.stop();
      const form = new FormData();
      form.append("audio", clip.blob, `turn.${clip.ext}`);
      form.append("meta", JSON.stringify({ speechMs: Math.round(clip.vad.speechMs), clipMs: Math.round(clip.vad.clipMs) }));
      await fetch(`/api/sessions/${sessionId.current}/turns`, { method: "POST", body: form }).then(run);
    }
  }, [interrupt, run]);

  // ---- hint button and silence timers ----
  // Steps 1–3 only show text. After step 3 the tutor speaks the model answer, which needs the full path.
  const endNow = () => {
    interrupt();
    turnEnded.current = false;
    void post({ e: "end" });
  };
  const askHint = () => void (ui.hint?.level === 3 ? post({ e: "hint_request" }) : postQuiet({ e: "hint_request" }));
  const reportCard = (cardId: string) => void postQuiet({ e: "card_report", cardId, reason: "was_correct" });

  useEffect(() => {
    if (ui.phase !== "waiting") return;
    const pulseT = setTimeout(() => setPulse(true), p.hintPulseSeconds * 1000);
    const nudgeT = setTimeout(() => void post({ e: "silence_timeout" }), p.nudgeSeconds * 1000);
    return () => {
      clearTimeout(pulseT);
      clearTimeout(nudgeT);
      setPulse(false);
    };
  }, [ui.phase, p.hintPulseSeconds, p.nudgeSeconds, post]);

  // Auto-send when the recording hits the maximum length.
  useEffect(() => {
    if (ui.phase !== "recording") return;
    const t = setTimeout(() => void toggleMic(), p.maxRecordingSeconds * 1000);
    return () => clearTimeout(t);
  }, [ui.phase, p.maxRecordingSeconds, toggleMic]);

  // Space = talk (desktop). Esc = stop the tutor.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "BUTTON" || el.tagName === "INPUT")) return;
      if (ev.code === "Space") {
        ev.preventDefault();
        void toggleMic();
      } else if (ev.code === "Escape" && phaseRef.current === "tutor") interrupt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMic, interrupt]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [ui.messages.length]);

  useEffect(() => {
    const rec = recorder.current;
    return () => {
      rec?.close();
      void player.current?.ctx.close().catch(() => {});
    };
  }, []);

  const chooseChip = (label: string) => {
    dispatch({ type: "topic_chosen" });
    dispatch({ type: "message", message: { id: `chip-${label}`, role: "learner", text: label } });
    interrupt();
    turnEnded.current = false;
    dispatch({ type: "phase", phase: "processing" });
    ctl()?.setState("thinking");
    void post({ e: "topic_chip", label });
  };

  const recording = ui.phase === "recording";
  const canMic = ui.phase === "tutor" || ui.phase === "waiting" || recording;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white text-neutral-900 md:max-w-3xl">
      <header className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-semibold">{p.tutorName} · Lactice</span>
        <span className="flex items-center gap-2">
          {ui.wrapUp && ui.phase !== "ended" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Wrapping up…</span>}
          {ui.sessionId && ui.phase !== "ended" && ui.phase !== "error" && (
            <button
              onClick={endNow}
              disabled={ui.phase === "recording" || ui.phase === "processing" || ui.phase === "starting"}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-900 disabled:opacity-40"
            >
              End conversation
            </button>
          )}
        </span>
      </header>

      <AvatarStage ref={stage} svg={p.svg} className="mx-auto h-[34dvh] max-h-80 w-full max-w-xs shrink-0 bg-pink-50 [&>svg]:h-full [&>svg]:w-full" />

      <ol ref={listRef} aria-live="polite" className={`${ui.phase === "ended" ? "hidden" : "flex-1"} space-y-2 overflow-y-auto bg-neutral-50 px-4 py-3`}>
        {ui.messages.map((m) => (
          <li key={m.id} className={m.role === "tutor" ? "mr-8" : "ml-8 text-right"}>
            <div
              className={`inline-block rounded-2xl px-3 py-2 text-left text-lg ${
                m.role === "tutor" ? "border-l-4 border-pink-400 bg-white" : m.unclear ? "bg-neutral-200 text-neutral-500 italic" : "bg-indigo-100"
              }`}
              lang={m.role === "tutor" || !m.unclear ? "ja" : "en"}
            >
              {m.text}
              {m.translation && <div className="mt-1 text-xs text-neutral-500">{m.translation}</div>}
            </div>
            {m.cards && m.cards.length > 0 && <CorrectionCards cards={m.cards} onReport={reportCard} />}
          </li>
        ))}
      </ol>

      {ui.error && (
        <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">
          {ui.error}
        </p>
      )}

      {ui.hint && ui.phase !== "ended" && (
        <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
          💡 <span className="font-medium">Hint {ui.hint.level}/3:</span> {ui.hint.text}
          {ui.hint.translation && <span className="text-amber-700"> — {ui.hint.translation}</span>}
        </p>
      )}

      {ui.phase === "ended" && ui.sessionId ? (
        <SummaryPanel sessionId={ui.sessionId} />
      ) : ui.phase === "intro" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6">
          <button onClick={begin} className="rounded-full bg-indigo-600 px-6 py-3 text-lg font-semibold text-white">
            Start talking with {p.tutorName}
          </button>
          <p className="text-xs text-neutral-500">Demo mode: scripted tutor, no API keys. Your mic is only used to simulate the flow.</p>
        </div>
      ) : (
        <footer className="px-4 pb-4 pt-2">
          {ui.needsTopic && ui.phase === "waiting" && (
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {ui.chips.map((c) => (
                <button key={c.label} onClick={() => chooseChip(c.label)} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100">
                  {c.label} <span className="text-neutral-400">{c.hint}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={askHint}
              disabled={ui.phase !== "waiting"}
              className={`rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-900 disabled:opacity-40 ${pulse ? "animate-pulse border-amber-400 bg-amber-50" : ""}`}
            >
              💡 Hint
            </button>
            <button
              onClick={() => void toggleMic()}
              disabled={!canMic}
              aria-pressed={recording}
              aria-label={recording ? "Stop and send" : "Start recording"}
              className={`h-[72px] w-[72px] rounded-full text-3xl text-white shadow-lg disabled:opacity-40 ${recording ? "bg-rose-500" : "bg-indigo-600"}`}
            >
              {recording ? "■" : "🎤"}
            </button>
            <button
              onClick={interrupt}
              disabled={ui.phase !== "tutor"}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-900 disabled:opacity-40"
            >
              ■ Stop
            </button>
          </div>
          <p className="mt-2 text-center text-sm text-neutral-600" data-testid="status">
            {ui.phase === "ended" ? `Conversation finished (${ui.endReason})` : STATUS_LABEL[ui.phase]}
          </p>
        </footer>
      )}
    </div>
  );
}
