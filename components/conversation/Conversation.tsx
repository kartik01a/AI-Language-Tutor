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
import { ModeToggle, useCoachMode, type CoachMode } from "./ModeToggle";
import { PhoneShell } from "@/components/ui/PhoneShell";
import { BubbleIcon, BulbIcon, MicIcon, StopIcon } from "@/components/ui/icons";

export interface ConversationProps {
  svg: string;
  tutorName: string;
  /** "demo" = scripted tutor with beep sounds; "real" = Deepgram + OpenAI + Azure. */
  mode: "demo" | "real";
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
            message: {
              id: e.turnId, role: "learner", text: e.display === "unclear" ? "(I couldn't catch this)" : (e.text ?? ""),
              unclear: e.display === "unclear", confirming: e.display === "confirm", diagnostic: e.diagnostic,
            },
          });
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
        case "translation":
          dispatch({ type: "translation", id: `${e.messageId}-${e.index}`, text: e.text });
          break;
        case "hint":
          dispatch({ type: "hint", hint: { level: e.level, text: e.text, translation: e.translation } });
          break;
        case "limits":
          dispatch({ type: "limits", wrapUp: e.wrapUp });
          break;
        case "turn_end":
          // The topic buttons stay until the SERVER has a topic (a greeting or a name isn't one).
          if (e.phase !== "TOPIC_SELECTION" && e.phase !== "INIT") dispatch({ type: "topic_chosen" });
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
  // Tutor (corrections) is the default; the choice is remembered on this device.
  const [coachMode, setStoredMode] = useCoachMode();
  const changeMode = (m: CoachMode) => {
    setStoredMode(m);
    if (sessionId.current) {
      void fetch(`/api/sessions/${sessionId.current}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coachMode: m }) }).catch(() => {});
    }
  };

  const begin = async () => {
    dispatch({ type: "phase", phase: "starting" });
    try {
      const pl = new Player();
      await pl.unlock();
      pl.onAllEnded = settle;
      player.current = pl;
      // Dev-only handle so browser checks can verify the audio output state (never in production).
      if (process.env.NODE_ENV !== "production") (window as unknown as { __lacticePlayer?: Player }).__lacticePlayer = pl;
      const rec = new Recorder();
      await rec.open();
      recorder.current = rec;
    } catch (e) {
      dispatch({ type: "error", message: MIC_HELP[classifyMicError(e)], fatal: true });
      return;
    }
    const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: p.level, coachMode }) });
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
      dispatch({ type: "confirm_clear" }); // speaking again withdraws an unanswered "Did you say …?"
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
  const answerConfirm = (yes: boolean) => {
    interrupt();
    turnEnded.current = false;
    dispatch({ type: "phase", phase: "processing" });
    ctl()?.setState("thinking");
    void post({ e: "confirm_heard", yes });
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

  const intro = ui.phase === "intro";
  const ended = ui.phase === "ended";
  const speaking = ui.phase === "tutor";

  return (
    <PhoneShell>
      {p.mode === "demo" && (
        <div role="status" className="bg-amber-card px-4 py-2 text-center text-xs text-amber-ink">
          <strong>Demo mode:</strong> scripted answers and beep sounds instead of a voice. For the real Yuki, stop the server and run{" "}
          <code className="rounded bg-white/60 px-1">npm run dev:real</code>.
        </div>
      )}
      <div className="shrink-0 bg-gradient-to-b from-iris-100 via-iris-50 to-paper-50">
      <header className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-iris-500 text-white">
            <BubbleIcon width={16} height={16} />
          </span>
          <span className="text-sm font-extrabold text-ink-900">
            {p.tutorName} <span className="font-semibold text-ink-400">· Lactice</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {ui.sessionId && !ended && ui.phase !== "error" && (
            <button
              onClick={() => changeMode(coachMode === "tutor" ? "casual" : "tutor")}
              aria-label={`Mode: ${coachMode}. Tap to switch`}
              className="rounded-full bg-iris-100 px-3 py-1.5 text-xs font-extrabold text-iris-700 transition active:scale-95"
            >
              {coachMode === "tutor" ? "Tutor" : "Casual"}
            </button>
          )}
          {ui.wrapUp && !ended && <span className="rounded-full bg-amber-card px-2.5 py-1 text-xs font-bold text-amber-ink">Wrapping up…</span>}
          {ui.sessionId && !ended && ui.phase !== "error" && (
            <button
              onClick={endNow}
              disabled={ui.phase === "recording" || ui.phase === "processing" || ui.phase === "starting"}
              className="rounded-full border border-ink-300 bg-white px-3 py-1.5 text-xs font-bold text-ink-600 transition active:scale-95 disabled:opacity-40"
            >
              End conversation
            </button>
          )}
        </span>
      </header>

      <div className="relative">
        <div className={`mx-auto aspect-square ${intro ? "h-[34dvh] max-h-[300px]" : "h-[27dvh] max-h-[240px]"} rounded-full transition-shadow ${speaking ? "animate-ring" : ""}`} aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) scale(0.78)" }} />
        <AvatarStage ref={stage} svg={p.svg} className={`relative mx-auto aspect-square ${intro ? "h-[34dvh] max-h-[300px]" : "h-[27dvh] max-h-[240px]"} [&>svg]:h-full [&>svg]:w-full`} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-paper-50 to-transparent" />
      </div>
      </div>

      {intro && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <h1 className="font-display text-3xl font-bold text-ink-900">
            Hi, I&apos;m {p.tutorName} <span lang="ja" className="text-2xl font-bold text-iris-500">ユキ</span>
          </h1>
          <p className="text-base text-ink-600">
            Let&apos;s chat in Japanese for about five minutes. I&apos;ll help when you&apos;re stuck and only correct what I&apos;m sure about.
          </p>
        </div>
      )}

      <ol ref={listRef} aria-live="polite" className={`${intro || ended ? "hidden" : "flex-1"} space-y-3 overflow-y-auto px-4 py-3`}>
        {ui.messages.map((m) => {
          const tutor = m.role === "tutor";
          return (
            <li key={m.id} className={`flex flex-col ${tutor ? "items-start" : "items-end"}`}>
              <div
                className={`max-w-[88%] px-4 py-2.5 text-left text-[19px] leading-[1.65] ${
                  tutor
                    ? "rounded-2xl rounded-tl-md bg-white text-ink-900 shadow-bubble ring-1 ring-ink-900/5"
                    : m.unclear
                      ? "rounded-2xl rounded-tr-md border border-dashed border-ink-300 bg-paper-100 text-ink-600 italic"
                      : m.confirming
                        ? "rounded-2xl rounded-tr-md bg-iris-50 text-ink-900 ring-1 ring-iris-300"
                        : "rounded-2xl rounded-tr-md bg-iris-500 text-white"
                }`}
                lang={tutor || !m.unclear ? "ja" : "en"}
              >
                {m.confirming ? <span className="italic" lang="ja">{m.text}</span> : m.text}
                {m.confirming && ui.confirmTurnId === m.id && (
                  <div className="mt-2 flex flex-wrap gap-2" data-testid="confirm-buttons" lang="en">
                    <button onClick={() => answerConfirm(true)} className="rounded-full bg-iris-500 px-3.5 py-1.5 text-sm font-bold text-white transition active:scale-95">
                      ✓ Yes, that&apos;s right
                    </button>
                    <button onClick={() => answerConfirm(false)} className="rounded-full border border-ink-300 bg-white px-3.5 py-1.5 text-sm font-bold text-ink-900 transition active:scale-95">
                      ✗ No, I&apos;ll say it again
                    </button>
                  </div>
                )}
                {m.unclear && m.diagnostic && (
                  <div className="mt-1 text-xs not-italic text-ink-400" data-testid="diagnostic" lang="en">
                    Why: <b>{m.diagnostic.reason}</b> · heard {m.diagnostic.heard ? <>“<span lang="ja">{m.diagnostic.heard}</span>”</> : "nothing"} · confidence{" "}
                    {m.diagnostic.meanConf === null ? "n/a" : m.diagnostic.meanConf.toFixed(2)} · speech {(m.diagnostic.speechMs / 1000).toFixed(1)}s of {(m.diagnostic.clipMs / 1000).toFixed(1)}s
                  </div>
                )}
                {m.translation && (
                  <div lang="en" className={`mt-1.5 border-t pt-1.5 text-[13px] leading-snug not-italic ${tutor ? "border-ink-900/10 text-ink-600" : "border-white/25 text-white/85"}`}>
                    {m.translation}
                  </div>
                )}
              </div>
              {m.cards && m.cards.length > 0 && <CorrectionCards cards={m.cards} onReport={reportCard} />}
            </li>
          );
        })}
      </ol>

      {ui.error && (
        <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">
          {ui.error}
        </p>
      )}

      {ui.hint && !ended && (
        <p className="mx-4 mb-2 rounded-xl bg-amber-card px-4 py-2.5 text-sm text-amber-ink">
          <span className="font-bold">Hint {ui.hint.level}/3:</span> {ui.hint.text}
          {ui.hint.translation && <span className="opacity-80"> — {ui.hint.translation}</span>}
        </p>
      )}

      {ended && ui.sessionId ? (
        <SummaryPanel sessionId={ui.sessionId} />
      ) : intro ? (
        <footer className="flex flex-col items-center gap-2 rounded-t-[28px] bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgba(28,27,46,0.08)]">
          <ModeToggle mode={coachMode} onChange={changeMode} />
          <button onClick={begin} className="w-full rounded-full bg-iris-500 px-6 py-3.5 text-lg font-extrabold text-white shadow-md transition active:scale-[0.97]">
            Start talking with {p.tutorName}
          </button>
          <p className="text-center text-xs text-ink-400">
            {p.mode === "demo"
              ? "Demo mode: a scripted tutor, no API keys. What you say is ignored; Yuki answers from a script."
              : "Live mode: Yuki hears you and answers with a real voice. Turn your volume up."}
          </p>
        </footer>
      ) : (
        <footer className="rounded-t-[28px] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(28,27,46,0.08)]">
          {ui.needsTopic && ui.phase === "waiting" && (
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {ui.chips.map((c) => (
                <button key={c.label} onClick={() => chooseChip(c.label)} className="rounded-full border border-iris-300 bg-iris-50 px-3.5 py-2 text-sm font-bold text-iris-700 transition active:scale-95">
                  {c.label} <span className="font-semibold text-ink-400">{c.hint}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 items-center">
            <button
              onClick={askHint}
              disabled={ui.phase !== "waiting"}
              className={`mx-auto flex w-16 flex-col items-center gap-1 text-xs font-bold text-ink-600 transition active:scale-95 disabled:opacity-40 ${pulse ? "animate-pulse text-amber-ink" : ""}`}
            >
              <span className={`flex size-12 items-center justify-center rounded-full ${pulse ? "bg-amber-card" : "bg-paper-100"}`}>
                <BulbIcon width={22} height={22} />
              </span>
              Hint
            </button>
            <button
              onClick={() => void toggleMic()}
              disabled={!canMic}
              aria-pressed={recording}
              aria-label={recording ? "Stop and send" : "Start recording"}
              className={`mx-auto flex size-[76px] items-center justify-center rounded-full text-white shadow-[0_6px_20px_rgba(91,91,214,0.4)] transition active:scale-95 disabled:opacity-40 ${
                recording ? "animate-ring bg-rose-rec shadow-[0_6px_20px_rgba(229,72,77,0.4)]" : "bg-iris-500"
              }`}
            >
              {recording ? <StopIcon width={30} height={30} /> : <MicIcon width={32} height={32} />}
            </button>
            <button
              onClick={interrupt}
              disabled={ui.phase !== "tutor"}
              className="mx-auto flex w-16 flex-col items-center gap-1 text-xs font-bold text-ink-600 transition active:scale-95 disabled:opacity-40"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-paper-100">
                <StopIcon width={20} height={20} />
              </span>
              Stop
            </button>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-ink-600" data-testid="status">
            {ended ? `Conversation finished (${ui.endReason})` : STATUS_LABEL[ui.phase]}
          </p>
        </footer>
      )}
    </PhoneShell>
  );
}
